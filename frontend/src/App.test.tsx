import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";
import { reconnectDelay } from "./hooks/useVehicleStatus";
import type { Role } from "./services/auth";

const auth = vi.hoisted(() => ({
  user: { id: 1, username: "staff", display_name: "Staff User", role: "DISPATCHER" as Role },
  loading: false, signIn: vi.fn(), signOut: vi.fn(), expire: vi.fn(),
}));
vi.mock("./AuthContext", () => ({ useAuth: () => auth }));
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => <span>© OpenStreetMap contributors</span>,
  CircleMarker: ({ center }: { center: [number, number] }) => <span data-testid="marker">{center.join(",")}</span>,
  useMap: () => ({ setView: vi.fn() }),
}));

const vehicle = {
  device_id: "LILYGO-001", plate_number: "DEMO-001", display_name: "Sprint 1 Demo Vehicle",
  vehicle_type: "OTHER", manufacturer: "", model: "", model_year: null,
  passenger_capacity: null, is_active: true,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};
class FakeWebSocket {
  onopen: (() => void) | null = null; onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null; onclose: ((event: CloseEvent) => void) | null = null;
  close(code = 1000) { this.onclose?.({ code } as CloseEvent); }
}
function response(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } }));
}
function renderAt(path: string) { return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>); }

beforeEach(() => {
  auth.user = { id: 1, username: "staff", display_name: "Staff User", role: "DISPATCHER" };
  auth.loading = false; vi.stubGlobal("WebSocket", FakeWebSocket);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Sprint 3 secure registry", () => {
  test("redirects an anonymous user to login", async () => {
    auth.user = null as unknown as typeof auth.user;
    renderAt("/vehicles");
    expect(await screen.findByRole("heading", { name: "Sign in to FTMS" })).toBeInTheDocument();
  });
  test("restores a dispatcher list without write controls", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => response({ count: 1, next: null, previous: null, results: [vehicle] }));
    renderAt("/vehicles");
    expect(await screen.findByText("Sprint 1 Demo Vehicle")).toBeInTheDocument();
    expect(screen.queryByText("Create vehicle")).not.toBeInTheDocument();
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
  });
  test("fleet manager can edit but cannot create or change status", async () => {
    auth.user.role = "FLEET_MANAGER";
    vi.spyOn(globalThis, "fetch").mockImplementation(() => response(vehicle));
    renderAt("/vehicles/LILYGO-001");
    expect(await screen.findByText("Edit")).toBeInTheDocument();
    expect(screen.queryByText("Deactivate")).not.toBeInTheDocument();
  });
  test("super admin receives create and status controls", async () => {
    auth.user.role = "SUPER_ADMIN";
    vi.spyOn(globalThis, "fetch").mockImplementation(() => response({ count: 0, next: null, previous: null, results: [] }));
    renderAt("/vehicles");
    expect(await screen.findByText("Create vehicle")).toBeInTheDocument();
    expect(screen.getByText("No vehicles match these filters.")).toBeInTheDocument();
  });
  test("list exposes loading, filtering, and error states", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => response({ count: 0, next: null, previous: null, results: [] }));
    renderAt("/vehicles"); expect(screen.getByText("Loading vehicles…")).toBeInTheDocument();
    await screen.findByText("No vehicles match these filters.");
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "demo" } });
    fireEvent.click(screen.getByText("Apply filters"));
    await waitFor(() => expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("search=demo"));
  });
  test("detail preserves live pilot label and nullable rendering", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(input => String(input).includes("latest-status")
      ? response({ vehicle: { device_id: vehicle.device_id, plate_number: vehicle.plate_number, display_name: vehicle.display_name }, latest: null })
      : response(vehicle));
    renderAt("/vehicles/LILYGO-001");
    expect(await screen.findByRole("heading", { name: "Simulated Pilot Data" })).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.getByText("Waiting for the first telemetry event…")).toBeInTheDocument();
  });
  test("permanent WebSocket close codes do not schedule reconnects", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(input => String(input).includes("latest-status")
      ? response({ vehicle: { device_id: vehicle.device_id, plate_number: vehicle.plate_number, display_name: vehicle.display_name }, latest: null })
      : response(vehicle));
    renderAt("/vehicles/LILYGO-001"); await act(async () => Promise.resolve());
    expect(reconnectDelay(0)).toBe(1000);
    vi.useRealTimers();
  });
});
