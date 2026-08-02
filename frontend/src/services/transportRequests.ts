import { api } from "./api";

export type TransportRequestStatus = "SUBMITTED" | "PENDING_APPROVAL" | "MORE_DETAILS_REQUIRED" | "APPROVED" | "REJECTED" | "CANCELLED";
export type ApiTransportRequest = {
  request_number: string; request_type: string; requester_name: string;
  requester_contact: string; source_system: string; external_reference: string;
  pickup_address: string; pickup_location: { longitude: number; latitude: number } | null;
  destination_address: string; destination_location: { longitude: number; latitude: number } | null;
  scheduled_at: string; priority: "NORMAL" | "HIGH"; passenger_count: number | null;
  load_description: string; required_vehicle_type: string; special_instructions: string;
  status: TransportRequestStatus; created_by: string; created_at: string; updated_at: string;
};
export type TransportRequestPage = { count: number; next: string | null; previous: string | null; results: ApiTransportRequest[] };
export type HistoryItem = { from_status: string; to_status: string; action: string; remarks: string; performed_by: string; performed_at: string };

export const getTransportRequests = (query: string, signal?: AbortSignal) =>
  api<TransportRequestPage>(`/api/v1/transport-requests/${query ? `?${query}` : ""}`, { signal });
export const createTransportRequest = (body: unknown, signal?: AbortSignal) =>
  api<ApiTransportRequest>("/api/v1/transport-requests/", { method: "POST", body: JSON.stringify(body), signal });
export const transportRequestAction = (number: string, action: string, remarks?: string, signal?: AbortSignal) =>
  api<ApiTransportRequest>(`/api/v1/transport-requests/${encodeURIComponent(number)}/${action}/`, { method: "POST", body: remarks === undefined ? undefined : JSON.stringify({ remarks }), signal });
export const getTransportRequestHistory = (number: string, signal?: AbortSignal) =>
  api<HistoryItem[]>(`/api/v1/transport-requests/${encodeURIComponent(number)}/history/`, { signal });
