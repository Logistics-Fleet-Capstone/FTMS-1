import { useEffect, useRef, useState } from "react";
import { Link, Redirect, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "./transport-requests.css";

type StageId = "requests" | "approval" | "dispatch" | "active" | "completed" | "calendar";
type RequestStatus = "new" | "pending" | "approved" | "active" | "completed" | "rejected";
type LatLng = { lat: number; lng: number };
type IconName = "home" | "map" | "vehicle" | "driver" | "safety" | "alerts" | "requests" | "approval" | "dispatch" | "route" | "calendar" | "analytics" | "maintenance" | "reports" | "devices" | "settings" | "active" | "completed" | "search" | "refresh" | "download" | "plus" | "logout";

type TransportRequest = {
  id: string;
  type: string;
  requester: string;
  origin: string;
  destination: string;
  scheduledTime: string;
  status: RequestStatus;
  priority: "High" | "Normal";
  vehicle: string;
  driver: string;
  distance: string;
  eta: string;
  safety: string;
  cost: string;
  originPoint: LatLng;
  destinationPoint: LatLng;
};

type StageData = Record<Exclude<StageId, "calendar">, TransportRequest[]>;
type GoogleMapInstance = { fitBounds: (bounds: GoogleBounds) => void };
type GoogleBounds = { extend: (position: LatLng) => void };
type GoogleMapObject = { setMap: (map: GoogleMapInstance | null) => void };
type GoogleMapsNamespace = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
    Marker: new (options: Record<string, unknown>) => GoogleMapObject;
    Polyline: new (options: Record<string, unknown>) => GoogleMapObject;
    LatLngBounds: new () => GoogleBounds;
  };
};
type GoogleWindow = Window & { google?: GoogleMapsNamespace };

let googleMapsPromise: Promise<GoogleMapsNamespace> | null = null;

function loadGoogleMaps(apiKey: string): Promise<GoogleMapsNamespace> {
  const googleWindow = window as GoogleWindow;
  if (googleWindow.google?.maps) return Promise.resolve(googleWindow.google);
  if (googleMapsPromise) return googleMapsPromise;
  googleMapsPromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (googleWindow.google?.maps) resolve(googleWindow.google);
      else reject(new Error("Google Maps did not initialize."));
    };
    const existing = document.querySelector<HTMLScriptElement>("script[data-ftms-google-maps]");
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.dataset.ftmsGoogleMaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("Google Maps failed to load.")), { once: true });
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

const stages: { id: StageId; label: string; icon: IconName }[] = [
  { id: "requests", label: "Requests", icon: "requests" },
  { id: "approval", label: "For Approval", icon: "approval" },
  { id: "dispatch", label: "Dispatch Queue", icon: "dispatch" },
  { id: "active", label: "Active Trips", icon: "active" },
  { id: "completed", label: "Completed", icon: "completed" },
  { id: "calendar", label: "Calendar View", icon: "calendar" },
];

const places = {
  oxford: { lat: 14.5631, lng: 121.0286 },
  naia3: { lat: 14.5196, lng: 121.0138 },
  bgc: { lat: 14.5508, lng: 121.051 },
  rockwell: { lat: 14.5652, lng: 121.0364 },
  ayala: { lat: 14.5493, lng: 121.0279 },
  pasay: { lat: 14.5378, lng: 120.9984 },
  manilaHotel: { lat: 14.5832, lng: 120.9746 },
  greenbelt: { lat: 14.551, lng: 121.0215 },
  smAura: { lat: 14.5469, lng: 121.0545 },
  guadalupe: { lat: 14.5668, lng: 121.0453 },
};

function request(id: string, type: string, requester: string, origin: string, destination: string, scheduledTime: string, status: RequestStatus, priority: "High" | "Normal", vehicle: string, driver: string, distance: string, eta: string, safety: string, cost: string, originPoint: LatLng, destinationPoint: LatLng): TransportRequest {
  return { id, type, requester, origin, destination, scheduledTime, status, priority, vehicle, driver, distance, eta, safety, cost, originPoint, destinationPoint };
}

const initialStageData: StageData = {
  requests: [
    request("TR-260801-014", "Airport pickup", "Maria Santos", "NAIA Terminal 3", "Oxford Suites Makati", "09:20", "new", "High", "Sedan", "Unassigned", "7.8 km", "24 min", "Pending", "₱680", places.naia3, places.oxford),
    request("TR-260801-013", "Guest transfer", "Kevin Lim", "Oxford Suites Makati", "BGC High Street", "09:05", "new", "Normal", "SUV", "Unassigned", "5.4 km", "18 min", "Pending", "₱430", places.oxford, places.bgc),
    request("TR-260801-012", "Food delivery", "Anna Reyes", "Oxford Suites Makati", "Rockwell Event Hall", "08:48", "new", "High", "Van", "Unassigned", "4.6 km", "16 min", "Pending", "₱470", places.oxford, places.rockwell),
    request("TR-260801-011", "Staff shuttle", "Miguel Torres", "MRT Ayala", "Oxford Suites Makati", "08:32", "new", "Normal", "Van", "Unassigned", "3.1 km", "12 min", "Pending", "₱280", places.ayala, places.oxford),
    request("TR-260801-010", "Supplier pickup", "Sophia Cruz", "Oxford Suites Makati", "Pasay Logistics Hub", "08:10", "new", "Normal", "Pickup", "Unassigned", "8.5 km", "27 min", "Pending", "₱710", places.oxford, places.pasay),
    request("TR-260801-009", "VIP transport", "Daniel Garcia", "Oxford Suites Makati", "The Manila Hotel", "07:55", "new", "High", "Premium Sedan", "Unassigned", "11.7 km", "35 min", "Pending", "₱1,120", places.oxford, places.manilaHotel),
  ],
  approval: [
    request("TR-260801-007", "VIP transport", "Isabella Tan", "NAIA Terminal 3", "Oxford Suites Makati", "10:40", "pending", "High", "Premium Sedan", "Unassigned", "8.8 km", "26 min", "Pending", "₱890", places.naia3, places.oxford),
    request("TR-260801-006", "Banquet logistics", "Marco Villanueva", "Oxford Suites Makati", "Rockwell Event Hall", "11:15", "pending", "Normal", "Cargo Van", "Unassigned", "4.9 km", "16 min", "Pending", "₱420", places.oxford, places.rockwell),
    request("TR-260801-005", "Staff shuttle", "Rina Flores", "Guadalupe Station", "Oxford Suites Makati", "12:00", "pending", "Normal", "Van", "Unassigned", "4.1 km", "15 min", "Pending", "₱340", places.guadalupe, places.oxford),
  ],
  dispatch: [
    request("TR-260801-003", "Airport pickup", "Harold Ong", "NAIA Terminal 3", "Oxford Suites Makati", "09:30", "approved", "High", "Toyota Altis · CAR-02", "Juan Dela Cruz", "7.8 km", "22 min", "Good", "₱650", places.naia3, places.oxford),
    request("TR-260801-002", "Guest transfer", "Camille Yu", "Oxford Suites Makati", "SM Aura", "10:10", "approved", "Normal", "Nissan Urvan · VAN-04", "Roberto Diaz", "5.8 km", "19 min", "Good", "₱480", places.oxford, places.smAura),
  ],
  active: [
    request("TR-260731-028", "Airport pickup", "Elaine Chua", "NAIA Terminal 3", "Oxford Suites Makati", "08:45", "active", "High", "Toyota Altis · CAR-02", "Juan Dela Cruz", "7.8 km", "14 min", "Good", "₱650", places.naia3, places.oxford),
    request("TR-260731-027", "Guest transfer", "Noel Javier", "Oxford Suites Makati", "BGC High Street", "08:50", "active", "Normal", "Nissan Urvan · VAN-04", "Roberto Diaz", "5.4 km", "8 min", "Good", "₱440", places.oxford, places.bgc),
    request("TR-260731-026", "Food delivery", "Celine Bautista", "Oxford Suites Makati", "Rockwell Event Hall", "09:00", "active", "Normal", "Toyota Hiace · VAN-02", "Arman Reyes", "4.6 km", "11 min", "Caution", "₱460", places.oxford, places.rockwell),
  ],
  completed: [
    request("TR-260731-024", "VIP transport", "Sean Uy", "Oxford Suites Makati", "The Manila Hotel", "23:20", "completed", "High", "Premium Sedan · CAR-05", "Victor Santos", "11.7 km", "Completed", "92/100", "₱1,080", places.oxford, places.manilaHotel),
    request("TR-260731-023", "Airport drop-off", "Grace Tan", "Oxford Suites Makati", "NAIA Terminal 3", "22:48", "completed", "Normal", "Toyota Altis · CAR-02", "Juan Dela Cruz", "7.0 km", "Completed", "96/100", "₱620", places.oxford, places.naia3),
    request("TR-260731-021", "Guest transfer", "Ivy Co", "Greenbelt 3", "Oxford Suites Makati", "21:44", "completed", "Normal", "Toyota Innova · MPV-03", "Luis Martin", "2.2 km", "Completed", "94/100", "₱230", places.greenbelt, places.oxford),
  ],
};

function Icon({ name }: { name: IconName }) {
  const common = { width: 18, height: 18, viewBox: "0 0 20 20", "aria-hidden": true } as const;
  switch (name) {
    case "home": return <svg {...common}><path d="M3.5 8.5 10 3.7l6.5 4.8M5.7 7.9v8h8.6v-8" /></svg>;
    case "map": return <svg {...common}><path d="M3.5 5.2 7.8 3.8l4.4 1.8 4.3-1.4v10.6l-4.3 1.4-4.4-1.8-4.3 1.4zM7.8 3.8v10.8M12.2 5.6v10.4" /></svg>;
    case "vehicle": return <svg {...common}><path d="M4.1 11.3h11.8M5.3 11.3l1.5-3.7h6.4l1.5 3.7M4.8 11.3v2.3M15.2 11.3v2.3" /><circle cx="7" cy="14.4" r="1.2" /><circle cx="13" cy="14.4" r="1.2" /></svg>;
    case "driver": return <svg {...common}><circle cx="10" cy="6.2" r="2.6" /><path d="M5.2 15.6c.8-2.3 2.8-3.6 4.8-3.6s4 1.3 4.8 3.6" /></svg>;
    case "safety": return <svg {...common}><path d="M10 3.6 15.2 5.7v4c0 3.2-2 5.2-5.2 6.7-3.2-1.5-5.2-3.5-5.2-6.7v-4zM7.8 10.1l1.4 1.4 3-3.2" /></svg>;
    case "alerts": return <svg {...common}><path d="M10 4.3a3.4 3.4 0 0 0-3.4 3.4v1.6c0 .8-.2 1.7-.7 2.4L5 13.1h9.9l-.9-1.4c-.5-.7-.7-1.6-.7-2.4V7.7A3.4 3.4 0 0 0 10 4.3ZM8.5 14.9a1.7 1.7 0 0 0 3 0" /></svg>;
    case "requests": return <svg {...common}><rect x="5.2" y="3.8" width="9.6" height="12.6" rx="1.7" /><path d="M7.8 7h4.7M7.8 10.1h4.7M7.8 13.2H11" /></svg>;
    case "approval": return <svg {...common}><rect x="4.6" y="4.2" width="10.8" height="11.6" rx="1.7" /><path d="m7.5 10.2 1.5 1.6 3.4-3.6" /></svg>;
    case "dispatch": return <svg {...common}><path d="M4.3 10h9.6m-3.1-3.9 3.9 3.9-3.9 3.9M4.5 5.8v8.4" /></svg>;
    case "route": return <svg {...common}><circle cx="5.2" cy="5.2" r="1.6" /><circle cx="14.8" cy="14.8" r="1.6" /><path d="M6.8 5.2c4.1 0 1.4 6.4 5.4 6.4" /></svg>;
    case "calendar": return <svg {...common}><rect x="3.8" y="5.2" width="12.4" height="10.4" rx="1.7" /><path d="M6.7 3.8v2.8M13.3 3.8v2.8M3.8 8.3h12.4" /></svg>;
    case "analytics": return <svg {...common}><path d="M4.5 15.5h11M6.4 13.8V9.7M10 13.8V6.4M13.6 13.8v-2.9" /></svg>;
    case "maintenance": return <svg {...common}><path d="M11.9 4.5a3 3 0 0 0 3.6 3.6L11 12.6l-3.5-.9-.9-3.5 4.5-4.5a3 3 0 0 0 .8.8ZM7 13l1.4 1.4" /></svg>;
    case "reports": return <svg {...common}><path d="M6 3.9h5.4L14 6.5v9.6H6zM11.4 3.9v2.8H14M8 10.1h4M8 12.9h4" /></svg>;
    case "devices": return <svg {...common}><rect x="4.4" y="4.2" width="11.2" height="8.4" rx="1.6" /><path d="M8.2 15.5h3.6M10 12.6v2.9" /></svg>;
    case "settings": return <svg {...common}><circle cx="10" cy="10" r="2.4" /><path d="M10 4.4v1.5M10 14.1v1.5m-4.1-10 1 1m6.2 6.2 1 1M4.4 10h1.5M14.1 10h1.5m-8.2 4.1 1-1m6.2-6.2 1-1" /></svg>;
    case "active": return <svg {...common}><circle cx="10" cy="10" r="6" /><path d="M10 4.6v5.2l3.4 2" /></svg>;
    case "completed": return <svg {...common}><circle cx="10" cy="10" r="6" /><path d="m7.4 10.1 1.6 1.6 3.6-3.8" /></svg>;
    case "search": return <svg {...common}><circle cx="8.7" cy="8.7" r="4.8" /><path d="m12.3 12.3 3.3 3.3" /></svg>;
    case "refresh": return <svg {...common}><path d="M15.3 7.5A5.7 5.7 0 1 0 15 13M15.3 4.7v2.8h-2.8" /></svg>;
    case "download": return <svg {...common}><path d="M10 3.8v8.1m-3.1-3 3.1 3.2 3.1-3.2M4.5 15.8h11" /></svg>;
    case "plus": return <svg {...common}><path d="M10 4.5v11M4.5 10h11" /></svg>;
    case "logout": return <svg {...common}><path d="M8.1 4.3H5.2v11.4h2.9M11.1 6.6 14.5 10l-3.4 3.4M14.3 10H8.2" /></svg>;
  }
}

function statusLabel(status: RequestStatus) {
  return ({ new: "New", pending: "Pending", approved: "Approved", active: "En route", completed: "Completed", rejected: "Rejected" } as const)[status];
}

function GoogleMapCanvas({ trip }: { trip: TransportRequest }) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing-key" | "error">("loading");
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  useEffect(() => {
    if (!apiKey) {
      setState("missing-key");
      return;
    }
    let active = true;
    let objects: GoogleMapObject[] = [];
    loadGoogleMaps(apiKey).then((google) => {
      if (!active || !mapElement.current) return;
      const map = new google.maps.Map(mapElement.current, { center: places.oxford, zoom: 13, disableDefaultUI: true, zoomControl: true, mapTypeControl: true, streetViewControl: false, fullscreenControl: false, gestureHandling: "greedy", styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }] });
      const midpoint = { lat: (trip.originPoint.lat + trip.destinationPoint.lat) / 2, lng: (trip.originPoint.lng + trip.destinationPoint.lng) / 2 };
      const originMarker = new google.maps.Marker({ map, position: trip.originPoint, title: trip.origin, label: { text: "A", color: "#ffffff" } });
      const destinationMarker = new google.maps.Marker({ map, position: trip.destinationPoint, title: trip.destination, label: { text: "B", color: "#ffffff" } });
      const vehicleMarker = new google.maps.Marker({ map, position: midpoint, title: trip.vehicle });
      const route = new google.maps.Polyline({ map, path: [trip.originPoint, midpoint, trip.destinationPoint], geodesic: true, strokeColor: "#00a66a", strokeOpacity: .9, strokeWeight: 5 });
      objects = [originMarker, destinationMarker, vehicleMarker, route];
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(trip.originPoint);
      bounds.extend(trip.destinationPoint);
      map.fitBounds(bounds);
      setState("ready");
    }).catch(() => {
      if (active) setState("error");
    });
    return () => {
      active = false;
      objects.forEach((object) => object.setMap(null));
    };
  }, [apiKey, trip]);
  return <div className="tr-map-canvas" aria-label={`Map route from ${trip.origin} to ${trip.destination}`}><div ref={mapElement} className="tr-google-map" />{state !== "ready" && <div className="tr-map-fallback"><Icon name="map" /><strong>{state === "missing-key" ? "Google Maps key required" : state === "error" ? "Google Maps could not load" : "Loading Google Maps…"}</strong><span>{state === "missing-key" ? "Add VITE_GOOGLE_MAPS_API_KEY to the local .env file." : "Check billing API activation and localhost referrer restrictions."}</span></div>}</div>;
}

function CalendarView() {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days = [26, 27, 28, 29, 30, 31, ...Array.from({ length: 29 }, (_, index) => index + 1)];
  const events: Record<number, { label: string; tone?: "warn" | "conflict" }[]> = {
    1: [{ label: "08:30 Airport pickup" }, { label: "10:00 Guest transfer", tone: "warn" }, { label: "10:15 VIP transfer", tone: "conflict" }],
    2: [{ label: "09:00 Staff shuttle" }, { label: "14:20 Supplier pickup" }],
    4: [{ label: "08:20 Guest transfer" }, { label: "08:30 Guest transfer", tone: "conflict" }],
    7: [{ label: "06:30 Staff shuttle" }, { label: "15:15 Airport pickup" }],
    11: [{ label: "12:40 Supplier pickup", tone: "warn" }, { label: "17:10 Guest transfer" }],
    18: [{ label: "08:00 Staff shuttle" }, { label: "08:05 Airport pickup", tone: "conflict" }],
    24: [{ label: "09:15 VIP transport", tone: "warn" }],
  };
  return <section className="tr-calendar-panel"><div className="tr-calendar-toolbar"><div><button type="button">‹</button><button type="button">Today</button><button type="button">›</button><strong>August 2026</strong></div><div><button type="button" className="is-active">Month</button><button type="button">Week</button><button type="button">Day</button><button type="button">Conflict check</button></div></div><div className="tr-calendar-grid">{dayNames.map((name) => <div key={name} className="tr-calendar-day-name">{name}</div>)}{days.slice(0, 35).map((day, index) => { const inMonth = index >= 6; return <div key={`${day}-${index}`} className={`tr-calendar-day${inMonth ? "" : " is-muted"}`}><span>{day}</span>{inMonth && events[day]?.map((event) => <div key={event.label} className={`tr-calendar-event${event.tone ? ` is-${event.tone}` : ""}`}>{event.label}</div>)}</div>; })}</div></section>;
}

function formatToday() {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date());
}

export default function TransportRequestsRoute() {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const [stageData, setStageData] = useState<StageData>(initialStageData);
  const [currentStage, setCurrentStage] = useState<StageId>("requests");
  const [selectedId, setSelectedId] = useState(initialStageData.requests[0].id);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [time, setTime] = useState(() => new Date());
  const [modal, setModal] = useState<"new" | "details" | null>(null);
  const [toast, setToast] = useState("");
  const [logoutBusy, setLogoutBusy] = useState(false);
  const pageSize = 5;

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (loading) return <main className="tr-auth-state">Restoring secure session…</main>;
  if (!user) return <Redirect to={{ pathname: "/login", state: { from: location.pathname } }} />;

  const rows = currentStage === "calendar" ? [] : stageData[currentStage];
  const filteredRows = rows.filter((item) => {
    const haystack = `${item.id} ${item.type} ${item.requester} ${item.origin} ${item.destination} ${item.vehicle} ${item.driver}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) && (statusFilter === "all" || item.status === statusFilter);
  });
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selected = rows.find((item) => item.id === selectedId) ?? rows[0] ?? initialStageData.requests[0];
  const allTrips = Object.values(stageData).flat();

  const switchStage = (stage: StageId) => {
    setCurrentStage(stage);
    setPage(1);
    setStatusFilter("all");
    if (stage !== "calendar" && stageData[stage][0]) setSelectedId(stageData[stage][0].id);
  };

  const advanceSelected = () => {
    if (currentStage === "calendar" || !selected) return;
    const sourceStage = currentStage;
    const transitions: Partial<Record<Exclude<StageId, "calendar">, { target: Exclude<StageId, "calendar">; status: RequestStatus; label: string }>> = {
      requests: { target: "approval", status: "pending", label: "Request sent for approval" },
      approval: { target: "dispatch", status: "approved", label: "Request approved" },
      dispatch: { target: "active", status: "active", label: "Trip dispatched" },
      active: { target: "completed", status: "completed", label: "Trip completed" },
    };
    const transition = transitions[sourceStage];
    if (!transition) {
      setModal("details");
      return;
    }
    setStageData((previous) => ({ ...previous, [sourceStage]: previous[sourceStage].filter((item) => item.id !== selected.id), [transition.target]: [{ ...selected, status: transition.status }, ...previous[transition.target]] }));
    setToast(transition.label);
    switchStage(transition.target);
  };

  const rejectSelected = () => {
    if (currentStage !== "approval") return;
    const next = stageData.approval.find((item) => item.id !== selected.id);
    setStageData((previous) => ({ ...previous, approval: previous.approval.filter((item) => item.id !== selected.id) }));
    if (next) setSelectedId(next.id);
    setToast("Request rejected");
  };

  const createRequest = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const created = request(`TR-${String(Date.now()).slice(-9)}`, String(data.get("type") || "Guest transfer"), String(data.get("requester") || "New requester"), String(data.get("origin") || "Oxford Suites Makati"), String(data.get("destination") || "Destination to confirm"), String(data.get("time") || "Now"), "new", String(data.get("priority")) === "High" ? "High" : "Normal", String(data.get("vehicle") || "Sedan"), "Unassigned", "—", "—", "Pending", "—", places.oxford, places.bgc);
    setStageData((previous) => ({ ...previous, requests: [created, ...previous.requests] }));
    setCurrentStage("requests");
    setSelectedId(created.id);
    setModal(null);
    setToast("New transport request created");
  };

  const exportCurrent = () => {
    const source = currentStage === "calendar" ? allTrips : rows;
    const csv = [["Request", "Type", "Requester", "Origin", "Destination", "Status", "Vehicle", "Driver", "ETA", "Safety", "Cost"], ...source.map((item) => [item.id, item.type, item.requester, item.origin, item.destination, statusLabel(item.status), item.vehicle, item.driver, item.eta, item.safety, item.cost])].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `transport-requests-${currentStage}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const actionLabel = currentStage === "requests" ? "Send for approval" : currentStage === "approval" ? "Approve request" : currentStage === "dispatch" ? "Dispatch trip" : currentStage === "active" ? "Complete trip" : "View summary";
  const initials = user.display_name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  return <div className="transport-app">
    <header className="tr-topbar"><div className="tr-brand"><div className="tr-brand-mark">FT<br />MS</div><div><strong>Fleet Command</strong><span>Logistics 2 Operations</span></div></div><div className="tr-client-logo"><img src="/client-logo.svg" alt="Oxford Suites Makati" /></div><div className="tr-top-actions"><time dateTime={time.toISOString()}>{time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time><div className="tr-avatar" title={`${user.display_name} · ${user.role.replaceAll("_", " ")}`}>{initials}</div></div></header>

    <aside className="tr-sidebar"><div className="tr-side-search"><Icon name="search" /><input aria-label="Search all transport requests" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /></div>
      <div className="tr-side-group"><span>Main</span><Link to="/vehicles"><Icon name="home" /><span>Home</span></Link><button type="button"><Icon name="map" /><span>Live Map</span></button><Link to="/vehicles"><Icon name="vehicle" /><span>Vehicles</span></Link><button type="button"><Icon name="driver" /><span>Drivers</span></button><button type="button"><Icon name="safety" /><span>Safety</span><small>4</small></button><button type="button"><Icon name="alerts" /><span>Alerts</span><small>7</small></button></div>
      <div className="tr-side-group"><span>Jobs & Routes</span><button type="button" className="is-active"><Icon name="requests" /><span>Transport Requests</span><small>{stageData.requests.length + stageData.approval.length}</small></button><button type="button"><Icon name="dispatch" /><span>Dispatching</span></button><button type="button"><Icon name="route" /><span>Route Planning</span></button><button type="button" onClick={() => switchStage("calendar")}><Icon name="calendar" /><span>Calendar</span></button></div>
      <div className="tr-side-group"><span>Intelligence</span><button type="button"><Icon name="analytics" /><span>Analytics</span></button><button type="button"><Icon name="maintenance" /><span>Maintenance</span></button><button type="button"><Icon name="reports" /><span>Reports</span></button></div>
      <div className="tr-side-group"><span>Administration</span><button type="button"><Icon name="devices" /><span>Devices</span></button><button type="button"><Icon name="settings" /><span>Settings</span></button></div>
      <div className="tr-user-panel"><div><strong>{user.display_name}</strong><span>{user.role.replaceAll("_", " ")}</span></div><button type="button" disabled={logoutBusy} aria-label="Sign out" onClick={() => { setLogoutBusy(true); void signOut().finally(() => setLogoutBusy(false)); }}><Icon name="logout" /></button></div>
    </aside>

    <main className="tr-main"><section className="tr-page-head"><h1>Transport Requests</h1><div className="tr-page-actions"><span className="tr-simulated-label">Simulated Pilot Data</span><button type="button">‹ &nbsp; Today · {formatToday()} &nbsp; ›</button><button type="button" onClick={() => setToast("Transport data refreshed")}><Icon name="refresh" />Refresh</button><button type="button" onClick={exportCurrent}><Icon name="download" />Export</button><button type="button" className="is-primary" onClick={() => setModal("new")}><Icon name="plus" />New request</button></div></section>
      <nav className="tr-stage-tabs" aria-label="Transport request stages">{stages.map((stage) => <button key={stage.id} type="button" className={stage.id === currentStage ? "is-active" : ""} onClick={() => switchStage(stage.id)}><Icon name={stage.icon} /><span>{stage.label}</span><small>{stage.id === "calendar" ? allTrips.filter((item) => item.status !== "completed").length : stageData[stage.id].length}</small></button>)}</nav>
      {currentStage === "calendar" ? <CalendarView /> : <section className="tr-workspace"><div className="tr-upper-grid">
        <section className="tr-panel tr-request-panel"><div className="tr-panel-head"><strong>{currentStage === "requests" ? "Incoming requests" : currentStage === "approval" ? "Pending approval" : currentStage === "dispatch" ? "Approved and unassigned" : currentStage === "active" ? "Trips in progress" : "Completed trips"}</strong></div><div className="tr-list-filters"><div><Icon name="search" /><input aria-label="Search current stage" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /></div><select aria-label="Filter status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="all">All status</option>{Array.from(new Set(rows.map((item) => item.status))).map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></div><div className="tr-request-list">{visibleRows.length ? visibleRows.map((item) => <button type="button" key={item.id} className={item.id === selected.id ? "is-selected" : ""} onClick={() => setSelectedId(item.id)}><span className="tr-initials">{item.requester.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span className="tr-request-main"><strong>{item.id}</strong><small>{item.type}</small><em>{item.origin} → {item.destination}</em><i>{item.scheduledTime} · {item.requester} · {item.distance}</i></span><span className="tr-request-side"><b className={`is-${item.status}`}>{statusLabel(item.status)}</b><small className={item.priority === "High" ? "is-high" : ""}>{item.priority}</small></span></button>) : <div className="tr-empty">No requests match your filters.</div>}</div><div className="tr-list-footer"><span>{filteredRows.length} request{filteredRows.length === 1 ? "" : "s"}</span><div>{Array.from({ length: totalPages }, (_, index) => <button key={index + 1} type="button" className={safePage === index + 1 ? "is-active" : ""} onClick={() => setPage(index + 1)}>{index + 1}</button>)}</div></div></section>
        <section className="tr-panel tr-map-panel"><GoogleMapCanvas trip={selected} /><div className="tr-map-card"><div className="tr-driver-row"><span className="tr-driver-avatar">{selected.driver === "Unassigned" ? "—" : selected.driver.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{selected.driver === "Unassigned" ? "Driver not assigned" : selected.driver}</strong><span>{selected.status === "active" ? "Moving W at 32 mph" : selected.status === "completed" ? "Trip completed" : selected.status === "approved" ? "Ready for dispatch" : "Awaiting assignment"}</span><small>{selected.origin} · {selected.scheduledTime}</small></div></div><div className="tr-driver-stats"><span><b>{selected.eta}</b><small>ETA</small></span><span><b>{selected.safety}</b><small>Safety</small></span><span><b>{selected.vehicle.split("·").pop()?.trim()}</b><small>Vehicle</small></span></div><div className="tr-map-actions"><button type="button" className="is-primary" onClick={advanceSelected}>{actionLabel}</button>{currentStage === "approval" && <><button type="button" onClick={() => setToast("More details requested")}>Request details</button><button type="button" className="is-danger" onClick={rejectSelected}>Reject</button></>}</div></div></section>
      </div>
      <section className="tr-metrics"><article><span><Icon name="requests" /></span><div><strong>{stageData.requests.length}</strong><small>Incoming today</small></div></article><article><span><Icon name="approval" /></span><div><strong>{stageData.approval.length}</strong><small>Awaiting approval</small></div></article><article><span><Icon name="dispatch" /></span><div><strong>{stageData.dispatch.length}</strong><small>Ready to dispatch</small></div></article><article><span><Icon name="active" /></span><div><strong>{stageData.active.length}</strong><small>Active trips</small></div></article><article><span>ETA</span><div><strong>14m</strong><small>Average active ETA</small></div></article><article><span>!</span><div><strong>{allTrips.filter((item) => item.priority === "High").length}</strong><small>High-priority items</small></div></article></section>
      <section className="tr-panel tr-table-panel"><div className="tr-table-toolbar"><div><button type="button" className="is-active">Timeline</button><button type="button">Trip details</button><button type="button">Safety</button><button type="button">Proof of service</button></div><div><select aria-label="Priority"><option>All priorities</option><option>High</option><option>Normal</option></select><button type="button">Columns</button></div></div><div className="tr-table-scroll"><table><thead><tr><th>Request</th><th>Requester</th><th>Vehicle</th><th>Driver</th><th>Distance</th><th>ETA</th><th>Safety</th><th>Cost</th><th>Operational timeline</th></tr></thead><tbody>{rows.map((item, index) => <tr key={item.id}><td>{item.id}</td><td>{item.requester}</td><td>{item.vehicle}</td><td>{item.driver}</td><td>{item.distance}</td><td>{item.eta}</td><td>{item.safety}</td><td>{item.cost}</td><td><div className="tr-timeline"><span style={{ left: `${8 + (index * 13) % 50}%`, width: `${24 + (index * 7) % 28}%` }} /><i style={{ left: `${38 + (index * 17) % 48}%` }} /></div></td></tr>)}</tbody></table></div></section></section>}
    </main>

    {modal && <div className="tr-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}><section className="tr-modal" role="dialog" aria-modal="true" aria-labelledby="tr-modal-title"><header><h2 id="tr-modal-title">{modal === "new" ? "Create transport request" : "Completed trip summary"}</h2><button type="button" aria-label="Close" onClick={() => setModal(null)}>×</button></header>{modal === "new" ? <form onSubmit={(event) => { event.preventDefault(); createRequest(event.currentTarget); }}><div className="tr-form-grid"><label>Requester name<input name="requester" required /></label><label>Request type<select name="type"><option>Airport pickup</option><option>Airport drop-off</option><option>Guest transfer</option><option>Staff shuttle</option><option>Food delivery</option><option>Supplier pickup</option><option>VIP transport</option></select></label><label>Pickup location<input name="origin" required /></label><label>Destination<input name="destination" required /></label><label>Schedule<input name="time" type="time" /></label><label>Priority<select name="priority"><option>Normal</option><option>High</option></select></label><label>Vehicle requirement<select name="vehicle"><option>Sedan</option><option>SUV</option><option>Van</option><option>Pickup</option><option>Cargo Van</option></select></label><label>Passengers / load<input name="load" type="number" min="1" defaultValue="1" /></label><label className="is-full">Special instructions<textarea name="notes" /></label></div><footer><button type="button" onClick={() => setModal(null)}>Cancel</button><button type="submit" className="is-primary">Save request</button></footer></form> : <div className="tr-summary"><dl><div><dt>Request</dt><dd>{selected.id}</dd></div><div><dt>Requester</dt><dd>{selected.requester}</dd></div><div><dt>Route</dt><dd>{selected.origin} → {selected.destination}</dd></div><div><dt>Vehicle</dt><dd>{selected.vehicle}</dd></div><div><dt>Driver</dt><dd>{selected.driver}</dd></div><div><dt>Cost</dt><dd>{selected.cost}</dd></div></dl><footer><button type="button" onClick={() => setModal(null)}>Close</button></footer></div>}</section></div>}
    {toast && <div className="tr-toast" role="status">{toast}</div>}
  </div>;
}
