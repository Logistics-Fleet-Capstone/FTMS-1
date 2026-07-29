import { useEffect, useState } from "react";
import {
  isNewerEvent,
  parseVehicleStatusMessage,
  vehicleStatusWebSocketUrl,
} from "../services/realtime";
import {
  getLatestStatus,
  type LatestStatusResponse,
} from "../services/telemetry";

export type RealtimeState =
  | "connecting"
  | "live"
  | "reconnecting"
  | "disconnected";

const maximumReconnectDelay = 30_000;

export function reconnectDelay(attempt: number): number {
  return Math.min(1_000 * 2 ** attempt, maximumReconnectDelay);
}

export function useVehicleStatus(deviceId: string) {
  const [status, setStatus] = useState<LatestStatusResponse | null>(null);
  const [requestState, setRequestState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [realtimeState, setRealtimeState] =
    useState<RealtimeState>("connecting");

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let pollId: number | null = null;
    let reconnectId: number | null = null;
    let reconnectAttempt = 0;
    const controllers = new Set<AbortController>();

    const applyStatus = (incoming: LatestStatusResponse) => {
      if (incoming.vehicle.device_id !== deviceId) return;
      setStatus((current) => {
        if (
          incoming.latest !== null &&
          isNewerEvent(incoming.latest, current?.latest ?? null)
        ) {
          return incoming;
        }
        if (current === null) return incoming;
        return current;
      });
      setRequestState("ready");
    };

    const fetchStatus = async () => {
      const controller = new AbortController();
      controllers.add(controller);
      try {
        applyStatus(await getLatestStatus(deviceId, controller.signal));
      } catch (error: unknown) {
        if (
          active &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setRequestState("error");
        }
      } finally {
        controllers.delete(controller);
      }
    };

    const stopPolling = () => {
      if (pollId !== null) {
        window.clearInterval(pollId);
        pollId = null;
      }
    };

    const startFallback = () => {
      if (pollId !== null) return;
      void fetchStatus();
      pollId = window.setInterval(() => void fetchStatus(), 5_000);
    };

    const connect = () => {
      if (!active) return;
      try {
        socket = new WebSocket(vehicleStatusWebSocketUrl(deviceId));
      } catch {
        setRealtimeState("disconnected");
        startFallback();
        const delay = reconnectDelay(reconnectAttempt);
        reconnectAttempt += 1;
        reconnectId = window.setTimeout(connect, delay);
        return;
      }
      socket.onopen = () => {
        reconnectAttempt = 0;
        stopPolling();
        setRealtimeState("live");
      };
      socket.onmessage = (event) => {
        const message = parseVehicleStatusMessage(String(event.data));
        if (message) applyStatus(message.data);
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (!active) return;
        setRealtimeState("reconnecting");
        startFallback();
        const delay = reconnectDelay(reconnectAttempt);
        reconnectAttempt += 1;
        reconnectId = window.setTimeout(connect, delay);
      };
    };

    void fetchStatus();
    connect();
    return () => {
      active = false;
      stopPolling();
      if (reconnectId !== null) window.clearTimeout(reconnectId);
      controllers.forEach((controller) => controller.abort());
      socket?.close();
    };
  }, [deviceId]);

  return { status, requestState, realtimeState };
}
