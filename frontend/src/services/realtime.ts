import type { LatestStatusResponse, TelemetryEvent } from "./telemetry";

export type VehicleStatusMessage = {
  type: "vehicle.status.snapshot" | "vehicle.status.updated";
  data: LatestStatusResponse;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isTelemetryEvent(value: unknown): value is TelemetryEvent {
  if (!isRecord(value)) return false;
  return (
    value.schema_version === "1.0" &&
    typeof value.event_id === "string" &&
    typeof value.sequence_number === "number" &&
    typeof value.device_id === "string" &&
    typeof value.recorded_at === "string" &&
    typeof value.received_at === "string" &&
    typeof value.latitude === "number" &&
    Number.isFinite(value.latitude) &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.longitude) &&
    typeof value.gnss_speed_kph === "number" &&
    Number.isFinite(value.gnss_speed_kph) &&
    isNullableNumber(value.rpm) &&
    isNullableNumber(value.coolant_c) &&
    isNullableNumber(value.engine_load_pct) &&
    ["NORMAL", "HARSH_BRAKING", "HARSH_ACCELERATION", "SHARP_TURN"].includes(
      String(value.driving_event),
    )
  );
}

export function parseVehicleStatusMessage(raw: string): VehicleStatusMessage | null {
  try {
    const message: unknown = JSON.parse(raw);
    if (!isRecord(message) || !isRecord(message.data)) return null;
    if (
      message.type !== "vehicle.status.snapshot" &&
      message.type !== "vehicle.status.updated"
    ) {
      return null;
    }
    const vehicle = message.data.vehicle;
    const latest = message.data.latest;
    if (
      !isRecord(vehicle) ||
      typeof vehicle.device_id !== "string" ||
      typeof vehicle.plate_number !== "string" ||
      typeof vehicle.display_name !== "string" ||
      (latest !== null && !isTelemetryEvent(latest))
    ) {
      return null;
    }
    return message as VehicleStatusMessage;
  } catch {
    return null;
  }
}

export function isNewerEvent(
  candidate: TelemetryEvent,
  current: TelemetryEvent | null,
): boolean {
  if (current === null) return true;
  const candidateRecordedAt = Date.parse(candidate.recorded_at);
  const currentRecordedAt = Date.parse(current.recorded_at);
  if (candidateRecordedAt !== currentRecordedAt) {
    return candidateRecordedAt > currentRecordedAt;
  }
  if (candidate.sequence_number !== current.sequence_number) {
    return candidate.sequence_number > current.sequence_number;
  }
  const candidateReceivedAt = Date.parse(candidate.received_at);
  const currentReceivedAt = Date.parse(current.received_at);
  if (candidateReceivedAt !== currentReceivedAt) {
    return candidateReceivedAt > currentReceivedAt;
  }
  return candidate.event_id > current.event_id;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export function vehicleStatusWebSocketUrl(deviceId: string): string {
  const configured = import.meta.env.VITE_WS_BASE_URL as string | undefined;
  const baseUrl =
    configured ??
    apiBaseUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  return `${baseUrl.replace(/\/$/, "")}/ws/v1/vehicles/${encodeURIComponent(deviceId)}/status/`;
}
