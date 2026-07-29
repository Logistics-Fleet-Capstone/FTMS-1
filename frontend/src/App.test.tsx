import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";
import { reconnectDelay } from "./hooks/useVehicleStatus";
import type {
  LatestStatusResponse,
  TelemetryEvent,
} from "./services/telemetry";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: ({ attribution }: { attribution: string }) => (
    <span>{attribution.replace("&copy;", "©")}</span>
  ),
  CircleMarker: ({ center }: { center: [number, number] }) => (
    <span data-testid="marker">{center.join(",")}</span>
  ),
  useMap: () => ({ setView: vi.fn() }),
}));

const health = { status: "ok", service: "ftms-backend", database: "ok" };
const waiting: LatestStatusResponse = {
  vehicle: {
    device_id: "LILYGO-001",
    plate_number: "DEMO-001",
    display_name: "Sprint 1 Demo Vehicle",
  },
  latest: null,
};
const latestEvent: TelemetryEvent = {
  schema_version: "1.0",
  event_id: "evt-1",
  sequence_number: 1,
  device_id: "LILYGO-001",
  recorded_at: new Date(Date.now() - 10_000).toISOString(),
  received_at: new Date(Date.now() - 9_000).toISOString(),
  latitude: 14.5186,
  longitude: 121.0196,
  gnss_speed_kph: 38.2,
  rpm: null,
  coolant_c: 88,
  engine_load_pct: 34,
  driving_event: "NORMAL",
};
const latest: LatestStatusResponse = {
  ...waiting,
  latest: latestEvent,
};

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.onopen?.();
  }

  message(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent);
  }

  malformed() {
    this.onmessage?.({ data: "{" } as MessageEvent);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.();
  }
}

function mockFetch(status: LatestStatusResponse = waiting) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = String(input);
    return Promise.resolve(
      Response.json(url.includes("/health/") ? health : status),
    );
  });
}

function update(overrides: Partial<TelemetryEvent> = {}) {
  return {
    type: "vehicle.status.updated",
    data: { ...latest, latest: { ...latestEvent, ...overrides } },
  };
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Sprint 2 vehicle status", () => {
  test("loads REST identity and preserves loading, waiting, and pilot states", async () => {
    mockFetch();
    render(<App />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(await screen.findByText(/Backend connection: Connected/)).toBeInTheDocument();
    expect(screen.getByText(/Waiting for the first telemetry event/)).toBeInTheDocument();
    expect(screen.getByText(/Waiting for live vehicle location/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Simulated Pilot Data" })).toBeInTheDocument();
  });

  test("renders REST telemetry, timestamps, nullable values, and map order", async () => {
    mockFetch(latest);
    render(<App />);

    expect(await screen.findByText("38.2 km/h")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText(new Date(latestEvent.recorded_at).toLocaleString())).toBeInTheDocument();
    expect(screen.getByText(new Date(latestEvent.received_at).toLocaleString())).toBeInTheDocument();
    expect(screen.getByTestId("marker")).toHaveTextContent("14.5186,121.0196");
    expect(screen.getByText("© OpenStreetMap contributors")).toBeInTheDocument();
    expect(screen.getByText(/Current position: 14.5186, 121.0196/)).toBeInTheDocument();
  });

  test("WebSocket snapshot and update display immediately and move the marker", async () => {
    mockFetch();
    render(<App />);
    await screen.findByText(/Waiting for the first telemetry event/);
    const socket = FakeWebSocket.instances[0];

    act(() => {
      socket.open();
      socket.message({ type: "vehicle.status.snapshot", data: latest });
    });
    expect(screen.getByText(/Real-time status: Live/)).toBeInTheDocument();
    expect(screen.getByTestId("marker")).toHaveTextContent("14.5186,121.0196");

    act(() => socket.message(update({
      event_id: "evt-2",
      sequence_number: 2,
      recorded_at: new Date(Date.now()).toISOString(),
      latitude: 14.52,
      longitude: 121.02,
    })));
    expect(screen.getByTestId("marker")).toHaveTextContent("14.52,121.02");
  });

  test("ignores older, malformed, and other-device messages", async () => {
    mockFetch(latest);
    render(<App />);
    await screen.findByTestId("marker");
    const socket = FakeWebSocket.instances[0];

    act(() => {
      socket.malformed();
      socket.message(update({
        event_id: "older",
        sequence_number: 0,
        recorded_at: new Date(Date.now() - 60_000).toISOString(),
        latitude: 1,
        longitude: 2,
      }));
      socket.message({
        ...update({ latitude: 3, longitude: 4 }),
        data: {
          ...latest,
          vehicle: { ...latest.vehicle, device_id: "OTHER" },
          latest: { ...latestEvent, device_id: "OTHER" },
        },
      });
    });

    expect(screen.getByTestId("marker")).toHaveTextContent("14.5186,121.0196");
  });

  test("disconnect starts immediate five-second fallback and reconnect stops it", async () => {
    vi.useFakeTimers();
    const fetchMock = mockFetch(latest);
    render(<App />);
    await act(async () => Promise.resolve());
    const baseline = fetchMock.mock.calls.length;

    act(() => FakeWebSocket.instances[0].close());
    expect(screen.getByText(/Reconnecting \/ REST fallback/)).toBeInTheDocument();
    await act(async () => Promise.resolve());
    expect(fetchMock.mock.calls.length).toBe(baseline + 1);

    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    expect(fetchMock.mock.calls.length).toBe(baseline + 2);
    act(() => FakeWebSocket.instances.at(-1)?.open());
    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    expect(fetchMock.mock.calls.length).toBe(baseline + 2);
  });

  test("reconnect backoff is bounded at thirty seconds", () => {
    expect(reconnectDelay(0)).toBe(1_000);
    expect(reconnectDelay(4)).toBe(16_000);
    expect(reconnectDelay(5)).toBe(30_000);
    expect(reconnectDelay(20)).toBe(30_000);
  });

  test("unmount closes sockets, aborts requests, and clears timers", async () => {
    vi.useFakeTimers();
    const fetchMock = mockFetch(latest);
    const { unmount } = render(<App />);
    await act(async () => Promise.resolve());
    act(() => FakeWebSocket.instances[0].close());
    const callsBeforeUnmount = fetchMock.mock.calls.length;

    unmount();
    expect(FakeWebSocket.instances.every((socket) => socket.closed)).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock.mock.calls.length).toBe(callsBeforeUnmount);
  });

  test("renders stale and error states independently", async () => {
    const stale = {
      ...latest,
      latest: {
        ...latestEvent,
        recorded_at: new Date(Date.now() - 61_000).toISOString(),
      },
    };
    mockFetch(stale);
    render(<App />);
    expect(await screen.findByText("Stale telemetry")).toBeInTheDocument();
  });

  test("shows disconnected when WebSocket construction fails", async () => {
    mockFetch();
    vi.stubGlobal("WebSocket", class {
      constructor() {
        throw new Error("unavailable");
      }
    });
    render(<App />);
    expect(await screen.findByText(/Real-time status: Disconnected/)).toBeInTheDocument();
  });

  test("shows the latest-status error while backend health remains connected", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => Promise.resolve(
      String(input).includes("/health/")
        ? Response.json(health)
        : new Response(null, { status: 503 }),
    ));
    render(<App />);
    expect(await screen.findByText("Latest-status request failed.")).toBeInTheDocument();
    expect(screen.getByText(/Backend connection: Connected/)).toBeInTheDocument();
  });
});
