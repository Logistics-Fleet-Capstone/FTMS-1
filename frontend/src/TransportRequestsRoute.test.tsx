import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "react-router-dom";
import { createMemoryHistory } from "history";
import { beforeEach, describe, expect, test, vi } from "vitest";
import TransportRequestsRoute from "./TransportRequestsRoute";

const auth = vi.hoisted(() => ({
  user: { id: 1, username: "manager", display_name: "Fleet Manager", role: "FLEET_MANAGER" },
  loading: false,
  signOut: vi.fn().mockResolvedValue(undefined),
  signIn: vi.fn(),
  expire: vi.fn(),
}));

vi.mock("./AuthContext", () => ({ useAuth: () => auth }));

function renderRoute(path = "/transport-requests", strict = false) {
  const history = createMemoryHistory({ initialEntries: [path] });
  const view = <Router history={history}><TransportRequestsRoute /></Router>;
  return { history, ...render(strict ? <StrictMode>{view}</StrictMode> : view) };
}

beforeEach(() => {
  auth.user = { id: 1, username: "manager", display_name: "Fleet Manager", role: "FLEET_MANAGER" };
  auth.loading = false;
  vi.restoreAllMocks();
});

describe("Transport Requests pilot workspace", () => {
  test("protects the route by redirecting anonymous users", async () => {
    auth.user = null as never;
    const { history } = renderRoute();
    await waitFor(() => expect(history.location.pathname).toBe("/login"));
  });

  test("shows the missing Google Maps key fallback and remains StrictMode-safe", () => {
    renderRoute("/transport-requests", true);
    expect(screen.getByText("Google Maps key required")).toBeInTheDocument();
    expect(document.querySelectorAll("script[data-ftms-google-maps]")).toHaveLength(0);
  });

  test("creates a request and preserves passenger/load and instructions", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_234_567_890);
    renderRoute();
    fireEvent.click(screen.getByText("New request"));
    fireEvent.change(screen.getByLabelText("Requester name"), { target: { value: "Test Requester" } });
    fireEvent.change(screen.getByLabelText("Pickup location"), { target: { value: "Oxford Suites" } });
    fireEvent.change(screen.getByLabelText("Destination"), { target: { value: "NAIA" } });
    fireEvent.change(screen.getByLabelText("Passengers / load"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("Special instructions"), { target: { value: "Meet at lobby" } });
    fireEvent.click(screen.getByText("Save request"));
    expect(screen.getByText("Test Requester")).toBeInTheDocument();
    expect(screen.getByText("Passengers / load: 7")).toBeInTheDocument();
    expect(screen.getByText("Instructions: Meet at lobby")).toBeInTheDocument();
  });

  test("moves one request through approval and ignores rapid duplicate actions", async () => {
    renderRoute();
    const send = screen.getByText("Send for approval");
    fireEvent.click(send);
    fireEvent.click(send);
    expect(screen.getByText("Request sent for approval")).toBeInTheDocument();
    expect(screen.getAllByText("TR-260801-014")).toHaveLength(2);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByText("Approve request"));
    expect(screen.getByText("Request approved")).toBeInTheDocument();
  });

  test("retains rejected identity, status, reason, actor data and timestamp", () => {
    vi.spyOn(window, "prompt").mockReturnValue("Capacity unavailable");
    renderRoute();
    fireEvent.click(screen.getByText("For Approval"));
    const requestId = screen.getAllByText("TR-260801-007")[0];
    fireEvent.click(screen.getByText("Reject"));
    expect(requestId).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("TR-260801-007")[0]);
    expect(screen.getByText("Rejected: Capacity unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Rejected by Fleet Manager at/)).toBeInTheDocument();
    expect(screen.getAllByText("Rejected").length).toBeGreaterThan(0);
  });

  test("supports search and pagination without losing filtered results", () => {
    renderRoute();
    const panel = screen.getByText("Incoming requests").closest(".tr-request-panel") as HTMLElement;
    fireEvent.click(within(panel).getByText("2"));
    expect(screen.getAllByText("TR-260801-009").length).toBeGreaterThan(0);
    const search = screen.getByLabelText("Search current stage");
    fireEvent.change(search, { target: { value: "Maria Santos" } });
    const list = search.closest(".tr-request-panel") as HTMLElement;
    expect(within(list).getByText("TR-260801-014")).toBeInTheDocument();
    expect(within(list).getByText("1 request")).toBeInTheDocument();
  });
});
