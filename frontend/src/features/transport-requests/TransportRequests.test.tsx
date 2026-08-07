import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "../../App";
import type { Role } from "../../services/auth";
import RequestMap from "./components/RequestMap";
import type { TransportRequestBase } from "./types";

const auth = vi.hoisted(() => ({
  user: { id: 1, username: "staff", display_name: "Staff User", role: "FLEET_MANAGER" as Role } as { id: number; username: string; display_name: string; role: Role } | null,
  loading: false, signIn: vi.fn(), signOut: vi.fn(), expire: vi.fn(),
}));
vi.mock("../../AuthContext", () => ({ useAuth: () => auth }));
const leaflet = vi.hoisted(() => ({ tileUrls: [] as string[], polylines: [] as [number, number][][], fitBounds: vi.fn(), setView: vi.fn(), invalidateSize: vi.fn() }));
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="request-map">{children}</div>,
  TileLayer: ({ url, eventHandlers }: { url: string; eventHandlers?: { tileerror?: () => void } }) => { leaflet.tileUrls.push(url); const layer = url.includes("/traffic/flow/") ? "tomtom-traffic-layer" : url.includes("/traffic/incidents/") ? "tomtom-incidents-layer" : "tomtom-base-layer"; return <span data-testid={layer} onClick={() => eventHandlers?.tileerror?.()} />; },
  CircleMarker: ({ center }: { center: [number, number] }) => <span data-testid="request-marker">{center.join(",")}</span>,
  Polyline: ({ positions }: { positions: [number, number][] }) => { leaflet.polylines.push(positions); return <span data-testid="request-route" />; },
  useMap: () => ({ fitBounds: leaflet.fitBounds, setView: leaflet.setView, invalidateSize: leaflet.invalidateSize, getContainer: () => document.createElement("div") }),
}));

const request = {
  id: "8f97093a-17bd-49a0-bf64-8ccbd533c8d5", request_number: "TR-20260806-A1B2C3",
  source_system: "HOTEL_MANAGEMENT_SYSTEM", external_reference: "HMS-1", request_type: "AIRPORT_PICKUP",
  requester_name: "Front Desk", requester_contact: "100", pickup_name: "NAIA Terminal 3", pickup_address: "Pasay",
  pickup_latitude: "14.508600", pickup_longitude: "121.019800", destination_name: "Oxford Suites Makati",
  destination_address: "Makati", destination_latitude: "14.565200", destination_longitude: "121.028600",
  scheduled_pickup_at: "2026-08-06T10:00:00Z", required_vehicle_type: "VAN", estimated_duration_minutes: 60,
  passenger_count: 2, luggage_count: 1, priority: "HIGH", notes: "", status: "FOR_APPROVAL", assigned_vehicle: null,
  created_by: "Manager", approved_by: null, approved_at: null, created_at: "2026-08-06T01:00:00Z", updated_at: "2026-08-06T01:00:00Z",
  latest_event_type: "CREATED", latest_event_at: "2026-08-06T01:00:00Z",
  events: [{ id: 1, event_type: "CREATED", previous_status: "", new_status: "FOR_APPROVAL", performed_by: "Manager", note: "", created_at: "2026-08-06T01:00:00Z" }],
};
const summary = { total: 1, for_approval: 1, needs_more_details: 0, approval_queue: 1, dispatch_queue: 0, approved_unassigned: 0, approved_assigned: 0, ready_for_dispatch: 0, scheduled_today: 1, high_priority: 1 };
const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
const errorJson = (body: unknown, status = 400) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

beforeEach(() => {
  leaflet.tileUrls.length = 0; leaflet.polylines.length = 0; leaflet.fitBounds.mockClear(); leaflet.setView.mockClear(); leaflet.invalidateSize.mockClear(); vi.stubEnv("VITE_TOMTOM_MAPS_KEY", "");
  auth.user = { id: 1, username: "staff", display_name: "Staff User", role: "FLEET_MANAGER" };
  vi.spyOn(globalThis, "fetch").mockImplementation(input => {
    const url = String(input);
    if (url.endsWith("summary/")) return json(summary);
    if (url.endsWith(`${request.id}/route/`)) return json({ request_id: request.id, traffic_mode: "live", distance_meters: 12400, duration_seconds: 1860, traffic_delay_seconds: 360, departure_time: "2026-08-07T10:00:00+08:00", arrival_time: "2026-08-07T10:31:00+08:00", geometry: { type: "LineString", coordinates: [[121.0198, 14.5086], [121.025, 14.54], [121.0286, 14.5652]] } });
    if (url.includes("calendar/?")) return json({ start: "2026-08-03", end: "2026-08-09", timezone: "Asia/Manila", results: [{ ...request, calendar_date: "2026-08-06", planning_end_at: "2026-08-06T11:00:00Z", vehicle_conflict: true, conflicting_requests: ["TR-OTHER"] }] });
    if (url.includes("/vehicles/")) return json({ count: 0, next: null, previous: null, results: [] });
    if (url.endsWith(`${request.id}/`)) return json(request);
    return json({ count: 1, next: null, previous: null, results: [request] });
  });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);

describe("Sprint 4 Transport Requests corrections", () => {
  test("keeps Leaflet mounted and reports a missing TomTom key", () => {
    render(<RequestMap request={null} />);
    expect(screen.getByTestId("request-map").closest(".request-map")).toHaveClass("tomtom-request-map", "request-map--empty");
    expect(screen.getByRole("alert")).toHaveTextContent("TomTom map key is not configured.");
    expect(screen.getByText("No request selected")).toBeInTheDocument();
  });
  test("configures the Orbis v2 base, flow, and incident raster layers", () => {
    vi.stubEnv("VITE_TOMTOM_MAPS_KEY", "configured-in-test"); render(<RequestMap request={request as TransportRequestBase} />);
    expect(screen.getByTestId("tomtom-base-layer")).toBeInTheDocument(); expect(screen.getByTestId("tomtom-traffic-layer")).toBeInTheDocument(); expect(screen.getByTestId("tomtom-incidents-layer")).toBeInTheDocument();
    expect(leaflet.tileUrls.some(url => url.includes("/maps/orbis/display/raster/tile/{z}/{x}/{y}") && url.includes("apiVersion=2") && url.includes("style=street-light"))).toBe(true);
    expect(leaflet.tileUrls.some(url => url.includes("/maps/orbis/traffic/flow/raster/tile/{z}/{x}/{y}") && url.includes("apiVersion=2"))).toBe(true);
    expect(leaflet.tileUrls.some(url => url.includes("/maps/orbis/traffic/incidents/raster/tile/{z}/{x}/{y}") && url.includes("apiVersion=2"))).toBe(true);
    expect(leaflet.tileUrls.some(url => url.includes("openstreetmap"))).toBe(false); expect(screen.getAllByTestId("request-marker")).toHaveLength(2); expect(leaflet.fitBounds).toHaveBeenCalled();
  });
  test("toggles traffic without remounting the base map", () => {
    vi.stubEnv("VITE_TOMTOM_MAPS_KEY", "configured-in-test"); render(<RequestMap request={null} />);
    const map = screen.getByTestId("request-map"); fireEvent.click(screen.getByRole("button", { name: "Traffic on" }));
    expect(screen.getByRole("button", { name: "Traffic off" })).toHaveAttribute("aria-pressed", "false"); expect(screen.queryByTestId("tomtom-traffic-layer")).not.toBeInTheDocument(); expect(screen.getByTestId("tomtom-base-layer")).toBeInTheDocument(); expect(screen.getByTestId("request-map")).toBe(map);
  });
  test("toggles incidents independently and handles tile failures", async () => {
    vi.stubEnv("VITE_TOMTOM_MAPS_KEY", "configured-in-test"); render(<RequestMap request={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Incidents on" })); expect(screen.getByRole("button", { name: "Incidents off" })).toHaveAttribute("aria-pressed", "false"); expect(screen.queryByTestId("tomtom-incidents-layer")).not.toBeInTheDocument(); expect(screen.getByTestId("tomtom-traffic-layer")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tomtom-base-layer")); expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load TomTom map tiles.");
  });
  test("returns the no-selection map to the Oxford Suites fallback", () => {
    vi.stubEnv("VITE_TOMTOM_MAPS_KEY", "configured-in-test"); render(<RequestMap request={null} />);
    expect(leaflet.setView).toHaveBeenCalledWith([14.5652, 121.0286], 13); expect(screen.getByText("No request selected")).toBeInTheDocument(); expect(screen.queryByTestId("request-marker")).not.toBeInTheDocument();
  });
  test("draws only backend road geometry and fits it with the request markers", () => {
    vi.stubEnv("VITE_TOMTOM_MAPS_KEY", "configured-in-test");
    const route = { request_id: request.id, traffic_mode: "live" as const, distance_meters: 12400, duration_seconds: 1860, traffic_delay_seconds: 360, departure_time: "2026-08-07T10:00:00+08:00", arrival_time: "2026-08-07T10:31:00+08:00", geometry: { type: "LineString" as const, coordinates: [[121.0198, 14.5086], [121.025, 14.54], [121.0286, 14.5652]] as [number, number][] } };
    render(<RequestMap request={request as TransportRequestBase} route={route} routeState="ready" />);
    expect(screen.getByTestId("request-route")).toBeInTheDocument();
    expect(leaflet.polylines[0]).toEqual([[14.5086, 121.0198], [14.54, 121.025], [14.5652, 121.0286]]);
  });
  test("loads routing only for the selected request and renders live metrics", async () => {
    vi.stubEnv("VITE_TOMTOM_MAPS_KEY", "configured-in-test"); renderAt("/transport-requests");
    expect(await screen.findByTestId("request-route")).toBeInTheDocument();
    expect(screen.getAllByText("12.4 km").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/31 min/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\+6 min traffic/).length).toBeGreaterThan(0);
    const routeCalls = vi.mocked(globalThis.fetch).mock.calls.filter(([input]) => String(input).endsWith("/route/"));
    expect(routeCalls).toHaveLength(1);
    expect(vi.mocked(globalThis.fetch).mock.calls.some(([input]) => String(input).includes("api.tomtom.com/maps/orbis/routing"))).toBe(false);
  });
  test("shows non-blocking route loading and reuses a calculated route on reselection", async () => {
    vi.stubEnv("VITE_TOMTOM_MAPS_KEY", "configured-in-test");
    const second = { ...request, id: "49bc47e8-74f8-4340-a94c-e9cc5619e734", request_number: "TR-SECOND" };
    const routeBody = (id: string) => ({ request_id: id, traffic_mode: "live", distance_meters: 12400, duration_seconds: 1860, traffic_delay_seconds: 360, departure_time: "2026-08-07T10:00:00+08:00", arrival_time: "2026-08-07T10:31:00+08:00", geometry: { type: "LineString", coordinates: [[121.0198, 14.5086], [121.0286, 14.5652]] } });
    let releaseFirst!: () => void; const firstPending = new Promise<Response>(resolve => { releaseFirst = () => resolve(new Response(JSON.stringify(routeBody(request.id)), { status: 200, headers: { "Content-Type": "application/json" } })); });
    vi.mocked(globalThis.fetch).mockImplementation(input => { const url = String(input); if (url.endsWith("summary/")) return json({ ...summary, total: 2, for_approval: 2, approval_queue: 2 }); if (url.endsWith(`${request.id}/route/`)) return firstPending; if (url.endsWith(`${second.id}/route/`)) return json(routeBody(second.id)); return json({ count: 2, next: null, previous: null, results: [request, second] }); });
    renderAt("/transport-requests"); expect(await screen.findAllByText("Calculating route…")).not.toHaveLength(0); expect(screen.getByTestId("request-map")).toBeInTheDocument();
    releaseFirst(); await screen.findByTestId("request-route");
    fireEvent.click(screen.getByRole("button", { name: /TR-SECOND/ })); await waitFor(() => expect(vi.mocked(globalThis.fetch).mock.calls.some(([input]) => String(input).endsWith(`${second.id}/route/`))).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(request.request_number) }));
    await waitFor(() => expect(vi.mocked(globalThis.fetch).mock.calls.filter(([input]) => String(input).endsWith(`${request.id}/route/`))).toHaveLength(1));
  });
  test("keeps the map usable when routing fails", async () => {
    vi.stubEnv("VITE_TOMTOM_MAPS_KEY", "configured-in-test");
    vi.mocked(globalThis.fetch).mockImplementation(input => { const url = String(input); if (url.endsWith("summary/")) return json(summary); if (url.endsWith("/route/")) return errorJson({ detail: "Route unavailable." }, 502); return json({ count: 1, next: null, previous: null, results: [request] }); });
    renderAt("/transport-requests");
    expect(await screen.findAllByText("Route unavailable")).not.toHaveLength(0);
    expect(screen.getByTestId("request-map")).toBeInTheDocument(); expect(screen.queryByTestId("request-route")).not.toBeInTheDocument();
  });
  test("protects the route", async () => {
    auth.user = null; renderAt("/transport-requests");
    expect(await screen.findByRole("heading", { name: "Sign in to FTMS" })).toBeInTheDocument();
  });
  test("redirects the legacy standalone Active Trips bookmark", async () => {
    renderAt("/active-trips");
    expect(await screen.findByRole("heading", { name: "Transport Requests" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Active Trips" })).toBeInTheDocument();
  });
  test("renders API data and all records on the page", async () => {
    const rows = Array.from({ length: 8 }, (_, index) => ({ ...request, id: `${request.id.slice(0, -1)}${index}`, request_number: `TR-PAGE-${index}` }));
    vi.mocked(globalThis.fetch).mockImplementation(input => String(input).endsWith("summary/") ? json({ ...summary, total: 8, for_approval: 8, approval_queue: 8 }) : json({ count: 8, next: null, previous: null, results: rows }));
    renderAt("/transport-requests");
    expect(await screen.findAllByText("TR-PAGE-7")).not.toHaveLength(0);
    expect(screen.getAllByText("NAIA Terminal 3").length).toBeGreaterThan(0);
  });
  test("keeps operational structures and disabled pagination when filters return no results", async () => {
    const emptySummary = Object.fromEntries(Object.keys(summary).map(key => [key, 0]));
    vi.mocked(globalThis.fetch).mockImplementation(input => String(input).endsWith("summary/")
      ? json(emptySummary)
      : json({ count: 0, next: null, previous: null, results: [] }));
    renderAt("/transport-requests");
    expect(await screen.findByText("No request selected")).toBeInTheDocument();
    const queue = screen.getByLabelText("Request queue");
    expect(queue).toHaveTextContent("No transport requests match your filters.");
    expect(queue).toHaveClass("request-picker--scroll");
    expect(document.querySelector(".transport-page")).toHaveClass("transport-page--workspace");
    expect(document.body).not.toHaveClass("scroll-locked", "transport-page--workspace");
    expect(document.querySelector(".app-layout")).not.toHaveClass("scroll-locked", "transport-page--workspace");
    expect(screen.getByLabelText("Request map")).toBeInTheDocument();
    expect(screen.getByTestId("request-map")).toBeInTheDocument();
    expect(screen.getByLabelText("Request queue").closest(".request-workspace")).toHaveClass("request-workspace--fixed");
    expect(screen.getByText("Scheduled today")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Operational requests" });
    const tableRegion = table.closest(".request-table-wrap");
    expect(tableRegion).toHaveClass("request-table-wrap--fill", "request-table-wrap--scroll");
    expect(tableRegion).not.toHaveClass("request-table-wrap--fixed");
    expect(within(table).getByRole("cell", { name: "No matching requests" })).toHaveAttribute("colspan", "9");
    const pager = screen.getByLabelText("Request pages");
    expect(pager).toHaveClass("queue-pager");
    expect(within(pager).getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(within(pager).getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(pager).toHaveTextContent("0 requests");
    expect(screen.queryByRole("navigation", { name: "Request pages" })).not.toBeInTheDocument();
  });
  test("removes Apply and keeps search and Filters in the compact toolbar", async () => {
    renderAt("/transport-requests");
    await screen.findAllByText("TR-20260806-A1B2C3");
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
    const toolbar = screen.getByRole("tablist").closest(".request-toolbar");
    expect(within(toolbar as HTMLElement).getByLabelText("Search requests")).toBeInTheDocument();
    expect(within(toolbar as HTMLElement).getByRole("button", { name: "Filters" })).toBeInTheDocument();
  });
  test("live-filters search after 400ms without changing results while typing", async () => {
    const fetchMock = vi.mocked(globalThis.fetch); renderAt("/transport-requests");
    await screen.findAllByText(request.request_number); fetchMock.mockClear(); vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Search requests"), { target: { value: "hotel" } });
    await act(async () => { vi.advanceTimersByTime(399); });
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("search=hotel") && !String(input).includes("page_size=5"))).toBe(false);
    await act(async () => { vi.advanceTimersByTime(1); await Promise.resolve(); });
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("search=hotel") && !String(input).includes("page_size=5"))).toBe(true);
  });
  test("Filters panel opens, closes on Escape, and reports active filter count", async () => {
    renderAt("/transport-requests"); await screen.findAllByText(request.request_number);
    const toggle = screen.getByRole("button", { name: "Filters" }); fireEvent.click(toggle);
    expect(screen.getByLabelText("Priority")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "HIGH" } });
    fireEvent.change(screen.getByLabelText("Assignment"), { target: { value: "assigned" } });
    expect(screen.getByRole("button", { name: /^Filters/ })).toHaveTextContent("2");
    expect(screen.getByLabelText("2 active filters")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByLabelText("Priority"), { key: "Escape" });
    expect(screen.queryByLabelText("Priority")).not.toBeInTheDocument(); expect(toggle).toHaveFocus();
  });
  test("an advanced filter applies immediately and resets pagination to page one", async () => {
    const fetchMock = vi.mocked(globalThis.fetch); fetchMock.mockImplementation(input => {
      const url = String(input); if (url.endsWith("summary/")) return json(summary);
      return json({ count: 2, next: url.includes("page=2") ? null : "http://localhost/api/v1/transport-requests/?page=2", previous: url.includes("page=2") ? "http://localhost/api/v1/transport-requests/" : null, results: [request] });
    });
    renderAt("/transport-requests"); await screen.findAllByText(request.request_number);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes("page=2"))).toBe(true)); fetchMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Filters" })); fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "HIGH" } });
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes("priority=HIGH") && !String(input).includes("page="))).toBe(true));
  });
  test("starts suggestions only after two characters and the debounce", async () => {
    const fetchMock = vi.mocked(globalThis.fetch); renderAt("/transport-requests");
    await screen.findAllByText(request.request_number); fetchMock.mockClear(); vi.useFakeTimers();
    const search = screen.getByLabelText("Search requests"); fireEvent.change(search, { target: { value: "T" } });
    await act(async () => { vi.advanceTimersByTime(350); });
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("page_size=5"))).toBe(false);
    fireEvent.change(search, { target: { value: "TR" } });
    await act(async () => { vi.advanceTimersByTime(299); });
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("page_size=5"))).toBe(false);
    await act(async () => { vi.advanceTimersByTime(1); await Promise.resolve(); });
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("search=TR") && String(input).includes("page_size=5"))).toBe(true);
  });
  test("shows the suggestion no-results state", async () => {
    vi.mocked(globalThis.fetch).mockImplementation(input => {
      const url = String(input); if (url.endsWith("summary/")) return json(summary);
      if (url.includes("page_size=5")) return json({ count: 0, next: null, previous: null, results: [] });
      return json({ count: 1, next: null, previous: null, results: [request] });
    });
    renderAt("/transport-requests"); await screen.findAllByText(request.request_number); vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Search requests"), { target: { value: "ZZ" } });
    await act(async () => { vi.advanceTimersByTime(300); await Promise.resolve(); }); vi.useRealTimers();
    expect(await screen.findByText("No results found")).toBeInTheDocument();
  });
  test("selecting a suggestion applies it on page one and selects the loaded request", async () => {
    const suggested = { ...request, id: "suggested-request", request_number: "TR-SUGGESTED", request_type: "GUEST_TRANSFER" };
    const fetchMock = vi.mocked(globalThis.fetch); fetchMock.mockImplementation(input => {
      const url = String(input); if (url.endsWith("summary/")) return json(summary);
      if (url.includes("page_size=5")) return json({ count: 1, next: null, previous: null, results: [suggested] });
      if (url.includes("search=TR-SUGGESTED")) return json({ count: 1, next: null, previous: null, results: [suggested] });
      return json({ count: 1, next: null, previous: null, results: [request] });
    });
    renderAt("/transport-requests"); await screen.findAllByText(request.request_number); vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Search requests"), { target: { value: "TR" } });
    await act(async () => { vi.advanceTimersByTime(300); await Promise.resolve(); }); vi.useRealTimers();
    fireEvent.click(await screen.findByRole("option", { name: /TR-SUGGESTED/ }));
    expect(screen.getByLabelText("Search requests")).toHaveValue("TR-SUGGESTED");
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes("search=TR-SUGGESTED") && !String(input).includes("page="))).toBe(true));
    const queue = await screen.findByLabelText("Request queue");
    expect(within(queue).getByRole("button", { name: /TR-SUGGESTED/ })).toHaveClass("selected");
  });
  test("zero filtered results clear selection and Reset Filters reloads page one", async () => {
    const fetchMock = vi.mocked(globalThis.fetch); fetchMock.mockImplementation(input => {
      const url = String(input); if (url.endsWith("summary/")) return json(summary);
      if (url.includes("search=none")) return json({ count: 0, next: null, previous: null, results: [] });
      return json({ count: 1, next: null, previous: null, results: [request] });
    });
    renderAt("/transport-requests"); await screen.findAllByText(request.request_number);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "HIGH" } });
    fireEvent.change(screen.getByLabelText("Source"), { target: { value: "MANUAL_STAFF_ENTRY" } });
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "GUEST_TRANSFER" } });
    fireEvent.change(screen.getByLabelText("Assignment"), { target: { value: "assigned" } });
    fireEvent.change(screen.getByLabelText("Scheduled date"), { target: { value: "2026-08-07" } });
    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Search requests"), { target: { value: "none" } });
    await act(async () => { vi.advanceTimersByTime(400); await Promise.resolve(); }); vi.useRealTimers();
    expect(await screen.findByText("No transport requests match your filters.")).toBeInTheDocument();
    expect(screen.getByText("No request selected")).toBeInTheDocument(); expect(screen.getByTestId("request-map")).toBeInTheDocument();
    expect(screen.queryByText(request.requester_name)).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByLabelText("Request queue")).getByRole("button", { name: "Reset Filters" }));
    await screen.findAllByText(request.request_number);
    expect(screen.getByLabelText("Search requests")).toHaveValue(""); expect(screen.queryByLabelText("Priority")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByLabelText("Priority")).toHaveValue(""); expect(screen.getByLabelText("Source")).toHaveValue(""); expect(screen.getByLabelText("Type")).toHaveValue(""); expect(screen.getByLabelText("Assignment")).toHaveValue("all"); expect(screen.getByLabelText("Scheduled date")).toHaveValue("");
    expect(screen.queryByLabelText(/active filters/)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("ordering=scheduled_pickup_at") && !String(input).includes("page="))).toBe(true);
  });
  test("For Approval requests both approval statuses", async () => {
    const fetchMock = vi.mocked(globalThis.fetch); renderAt("/transport-requests");
    await screen.findAllByText("TR-20260806-A1B2C3"); fireEvent.click(screen.getByRole("tab", { name: /For Approval/ }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes("status=FOR_APPROVAL%2CNEEDS_MORE_DETAILS"))).toBe(true));
  });
  test("uses the same rigid workspace and table structure across operational tabs", async () => {
    renderAt("/transport-requests");
    for (const name of ["Requests", "For Approval", "Dispatch Queue"]) {
      if (name !== "Requests") fireEvent.click(screen.getByRole("tab", { name: new RegExp(name) }));
      const queue = await screen.findByLabelText("Request queue");
      const workspace = queue.closest(".request-workspace");
      expect(workspace).toHaveClass("request-workspace--fixed");
      expect(within(workspace as HTMLElement).getByLabelText("Request map")).toBeInTheDocument();
      const tableRegion = screen.getByRole("table", { name: "Operational requests" }).closest(".request-table-wrap");
      expect(tableRegion).toHaveClass("request-table-wrap--fill", "request-table-wrap--scroll");
      expect(tableRegion).not.toHaveClass("request-table-wrap--fixed");
      expect(within(queue).getByLabelText("Request pages")).toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "Request pages" })).not.toBeInTheDocument();
    }
  });
  test("manager action visibility and required-note dialog", async () => {
    renderAt(`/transport-requests/${request.id}`);
    expect(await screen.findByRole("button", { name: "Approve" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Request More Details" }));
    const confirm = screen.getByRole("button", { name: "Request Details" }); expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Reason (required)"), { target: { value: "Confirm passenger names" } });
    expect(confirm).toBeEnabled();
  });
  test("dispatcher can resubmit but cannot approve or reject", async () => {
    auth.user = { id: 2, username: "dispatch", display_name: "Dispatcher", role: "DISPATCHER" };
    const needsDetails = { ...request, status: "NEEDS_MORE_DETAILS" };
    vi.mocked(globalThis.fetch).mockImplementation(input => String(input).includes("/vehicles/") ? json({ count: 0, next: null, previous: null, results: [] }) : json(needsDetails));
    renderAt(`/transport-requests/${request.id}`);
    expect(await screen.findByRole("button", { name: "Resubmit for Approval" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });
  test("Dispatch Queue requests APPROVED and future fields stay honest", async () => {
    const fetchMock = vi.mocked(globalThis.fetch); renderAt("/transport-requests");
    await screen.findAllByText("TR-20260806-A1B2C3"); fireEvent.click(screen.getByRole("tab", { name: /Dispatch Queue/ }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes("status=APPROVED"))).toBe(true));
    expect(screen.getAllByText("Planned").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Juan Dela Cruz|₱/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/12\.4 km/).length).toBeGreaterThan(0);
  });
  test("Calendar hides KPIs and preserves its full-height scroll structure across views", async () => {
    renderAt("/transport-requests"); await screen.findAllByText("TR-20260806-A1B2C3");
    expect(screen.getByText("Scheduled today")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Calendar View" }));
    expect(await screen.findByRole("button", { name: "Daily" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weekly" })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("Vehicle conflict")).toBeInTheDocument();
    expect(screen.queryByText("Scheduled today")).not.toBeInTheDocument();
    expect(document.querySelector(".transport-page")).toHaveClass("transport-page--calendar");
    expect(screen.getByLabelText("Transport request calendar")).toHaveClass("schedule-calendar");
    const weeklyRegion = screen.getByRole("region", { name: "Calendar schedule grid" });
    expect(weeklyRegion).toHaveClass("calendar-scroll-region--weekly");
    expect(weeklyRegion.querySelector(".calendar-grid--weekly")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Daily" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "Calendar schedule grid" })).toHaveClass("calendar-scroll-region--daily"));
    await waitFor(() => expect(document.querySelector(".calendar-grid--daily")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Weekly" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "Calendar schedule grid" })).toHaveClass("calendar-scroll-region--weekly"));
    await waitFor(() => expect(document.querySelector(".calendar-grid--weekly")).not.toBeNull());
  });
  test("all tabs retain one full-width panel and planned tabs stay honest", async () => {
    renderAt("/transport-requests"); await screen.findAllByText("TR-20260806-A1B2C3");
    expect(screen.getByRole("tab", { name: /Requests/ }).querySelector(".tab-count")).toHaveTextContent("1");
    for (const name of ["Active Trips", "Completed", "Calendar View"]) {
      expect(screen.getByRole("tab", { name }).querySelector(".tab-count")).toBeNull();
    }
    for (const name of ["Requests", "For Approval", "Dispatch Queue", "Active Trips", "Completed", "Calendar View"]) {
      fireEvent.click(screen.getByRole("tab", { name: new RegExp(name) }));
      expect(document.querySelectorAll(".transport-tab-panel")).toHaveLength(1);
      expect(document.querySelector(".transport-tab-panel")).toHaveClass(`transport-tab-panel--${name.toLowerCase().replaceAll(" ", "-")}`);
    }
    fireEvent.click(screen.getByRole("tab", { name: "Active Trips" }));
    expect(screen.getByText("Driver Assignment and Trip Lifecycle are planned")).toBeInTheDocument();
    expect(document.querySelector(".transport-page")).toHaveClass("transport-page--workspace", "transport-page--planned");
    fireEvent.click(screen.getByRole("tab", { name: "Completed" }));
    expect(screen.getByText("Trip Completion is planned")).toBeInTheDocument();
    expect(screen.getByText("Trip Completion is planned").closest(".transport-tab-panel")).toHaveClass("transport-tab-panel--completed");
    expect(screen.queryByText(/completed trip #|proof uploaded|final cost/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Calendar View" }));
    expect(await screen.findByTestId("calendar-scroll-region")).toHaveClass("calendar-scroll-region--weekly");
    expect(screen.getByLabelText("Transport request calendar").closest(".transport-tab-panel")).not.toBeNull();
  });
  test("vehicle selector follows selection, clears stale values, and refresh preserves selection", async () => {
    const assignedVehicle = { device_id: "VAN-01", plate_number: "VAN-01", display_name: "Guest Van", vehicle_type: "VAN", passenger_capacity: 6, is_active: true };
    const assigned = { ...request, id: "assigned-request", request_number: "TR-ASSIGNED", status: "APPROVED", assigned_vehicle: assignedVehicle };
    const unassigned = { ...request, id: "unassigned-request", request_number: "TR-UNASSIGNED", status: "APPROVED", assigned_vehicle: null };
    vi.mocked(globalThis.fetch).mockImplementation(input => {
      const url = String(input);
      if (url.endsWith("summary/")) return json({ ...summary, dispatch_queue: 2, approved_assigned: 1, approved_unassigned: 1 });
      if (url.includes("/vehicles/")) return json({ count: 1, next: null, previous: null, results: [assignedVehicle] });
      return json({ count: 2, next: null, previous: null, results: [assigned, unassigned] });
    });
    renderAt("/transport-requests"); await screen.findAllByText("TR-ASSIGNED");
    fireEvent.click(screen.getByRole("tab", { name: /Dispatch Queue/ }));
    const selector = await screen.findByLabelText("Manual vehicle");
    await waitFor(() => expect(selector).toHaveValue("VAN-01"));
    const unassignedButton = screen.getAllByRole("button").find(button => button.textContent?.includes("TR-UNASSIGNED"));
    expect(unassignedButton).toBeDefined(); fireEvent.click(unassignedButton!);
    expect(selector).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));
    await waitFor(() => expect(screen.getByLabelText("Manual vehicle")).toHaveValue(""));
    expect(unassignedButton).toHaveClass("selected");
  });
  test("uses the full-width responsive layout for Edit Transport Request", async () => {
    renderAt(`/transport-requests/${request.id}/edit`);
    const heading = await screen.findByRole("heading", { name: "Edit Transport Request" });
    const page = heading.closest(".form-page"); const form = screen.getByRole("button", { name: "Save Changes" }).closest("form");
    expect(page).toHaveClass("form-page--edit-request"); expect(form).toHaveClass("request-form--edit");
    expect(screen.getByLabelText("Pickup address").closest("label")).toHaveClass("edit-field--wide");
    expect(screen.getByLabelText("Destination address").closest("label")).toHaveClass("edit-field--wide");
    expect(screen.getByLabelText("Notes").closest("label")).toHaveClass("edit-field--long");
    expect(within(form as HTMLElement).getByRole("link", { name: "Cancel" })).toBeInTheDocument();
  });
  test("renders backend field and non-field errors without discarding form values", async () => {
    vi.mocked(globalThis.fetch).mockImplementation((_input, init) => init?.method === "POST"
      ? errorJson({ request_type: ["Choose a supported request type."], passenger_count: ["Too many passengers."], pickup_address: ["Confirm the pickup address."], notes: ["Notes need review."], non_field_errors: ["Pickup and destination must differ."] })
      : json(summary));
    renderAt("/transport-requests/new");
    fireEvent.change(screen.getByLabelText("Scheduled pickup"), { target: { value: "2026-08-07T10:00" } });
    fireEvent.change(screen.getByLabelText("Requester name"), { target: { value: "Keep this value" } });
    fireEvent.submit(screen.getByRole("button", { name: "Create Request" }).closest("form")!);
    expect(await screen.findByText("Choose a supported request type.")).toBeInTheDocument();
    expect(screen.getByText("Pickup and destination must differ.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Request type/)).toHaveAttribute("aria-describedby", "request_type-error");
    expect(screen.getByLabelText(/Passengers/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Requester name")).toHaveValue("Keep this value");
  });
});
