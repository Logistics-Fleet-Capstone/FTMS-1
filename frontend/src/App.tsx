import { FormEvent, useEffect, useState } from "react";
import { Link, Redirect, Route, Switch, useHistory, useLocation, useParams } from "react-router-dom";
import { useAuth } from "./AuthContext";
import LiveVehicleMap from "./components/LiveVehicleMap";
import { useVehicleStatus } from "./hooks/useVehicleStatus";
import { ApiError } from "./services/api";
import type { Role } from "./services/auth";
import { changeVehicleStatus, createVehicle, editVehicle, getVehicle, getVehicles, vehicleTypes, type Vehicle } from "./services/vehicles";
import "./styles.css";

const canEdit = (role: Role) => role === "SUPER_ADMIN" || role === "FLEET_MANAGER";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth(); const location = useLocation();
  if (loading) return <main><p>Restoring session…</p></main>;
  return user ? <>{children}</> : <Redirect to={{ pathname: "/login", state: { from: location.pathname } }} />;
}
function Shell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  return <main><section className="shell"><header className="app-header">
    <Link to="/vehicles"><strong>FTMS Vehicle Registry</strong></Link>
    <span>{user?.display_name} · {user?.role.replaceAll("_", " ")}</span>
    <button onClick={() => void signOut()}>Sign out</button>
  </header>{children}</section></main>;
}
function LoginPage() {
  const { user, signIn } = useAuth(); const history = useHistory(); const location = useLocation();
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  if (user) return <Redirect to="/vehicles" />;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); const data = new FormData(event.currentTarget);
    try {
      await signIn(String(data.get("username")), String(data.get("password")));
      const requested = (location.state as { from?: string } | null)?.from;
      history.replace(requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/vehicles");
    } catch { setError("Unable to sign in with those credentials."); } finally { setBusy(false); }
  };
  return <main><section className="shell auth-card"><p className="eyebrow">Secure staff access</p><h1>Sign in to FTMS</h1>
    <form onSubmit={submit}><label>Username<input name="username" required autoComplete="username" /></label>
      <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
      {error && <p className="message message--error" role="alert">{error}</p>}
      <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form>
  </section></main>;
}
function VehicleList() {
  const { user } = useAuth(); const [page, setPage] = useState<Awaited<ReturnType<typeof getVehicles>> | null>(null);
  const [error, setError] = useState(false); const [query, setQuery] = useState(""); const [search, setSearch] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    getVehicles(query, controller.signal).then(setPage).catch((reason: unknown) => {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(true);
    }); return () => controller.abort();
  }, [query]);
  const filter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const values = new URLSearchParams();
    if (search.trim()) values.set("search", search.trim());
    for (const key of ["is_active", "vehicle_type"]) { const value = String(data.get(key) ?? ""); if (value) values.set(key, value); }
    setPage(null); setError(false); setQuery(values.toString());
  };
  return <><div className="page-title"><div><p className="eyebrow">Sprint 3</p><h1>Vehicles</h1></div>
    {user?.role === "SUPER_ADMIN" && <Link className="button" to="/vehicles/new">Create vehicle</Link>}</div>
    <form className="filters" onSubmit={filter}><label>Search<input value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label>Status<select name="is_active"><option value="">All</option><option value="true">Active</option><option value="false">Inactive</option></select></label>
      <label>Type<select name="vehicle_type"><option value="">All</option>{vehicleTypes.map(v => <option key={v}>{v}</option>)}</select></label><button>Apply filters</button></form>
    {!page && !error && <p>Loading vehicles…</p>}{error && <p role="alert" className="message message--error">Unable to load vehicles.</p>}
    {page?.results.length === 0 && <p>No vehicles match these filters.</p>}
    <div className="vehicle-list">{page?.results.map(vehicle => <article key={vehicle.device_id}><div>
      <h2><Link to={`/vehicles/${encodeURIComponent(vehicle.device_id)}`}>{vehicle.display_name}</Link></h2>
      <p>{vehicle.device_id} · {vehicle.plate_number} · {vehicle.vehicle_type}</p></div>
      <span className={vehicle.is_active ? "freshness--fresh" : "freshness--stale"}>{vehicle.is_active ? "Active" : "Inactive"}</span>
      {user && canEdit(user.role) && <Link to={`/vehicles/${encodeURIComponent(vehicle.device_id)}/edit`}>Edit</Link>}</article>)}</div>
    {page && <nav className="pagination" aria-label="Vehicle pages"><button disabled={!page.previous} onClick={() => { setError(false); setPage(null); setQuery(new URL(page.previous!).search.slice(1)); }}>Previous</button>
      <span>{page.count} vehicle{page.count === 1 ? "" : "s"}</span><button disabled={!page.next} onClick={() => { setError(false); setPage(null); setQuery(new URL(page.next!).search.slice(1)); }}>Next</button></nav>}
  </>;
}
function VehicleForm({ editing = false }: { editing?: boolean }) {
  const { user } = useAuth(); const { deviceId = "" } = useParams<{ deviceId: string }>(); const history = useHistory();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null); const [error, setError] = useState("");
  useEffect(() => { if (!editing) return; const controller = new AbortController();
    getVehicle(deviceId, controller.signal).then(setVehicle).catch(() => setError("Unable to load vehicle."));
    return () => controller.abort(); }, [editing, deviceId]);
  if (!user || (editing ? !canEdit(user.role) : user.role !== "SUPER_ADMIN")) return <Redirect to="/vehicles" />;
  if (editing && !vehicle && !error) return <p>Loading vehicle…</p>;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); const data = new FormData(event.currentTarget); const payload: Record<string, unknown> = {};
    for (const key of ["device_id","plate_number","display_name","vehicle_type","manufacturer","model"]) if (!editing || key !== "device_id") payload[key] = String(data.get(key) ?? "");
    for (const key of ["model_year","passenger_capacity"]) { const value = String(data.get(key) ?? ""); payload[key] = value ? Number(value) : null; }
    try { const saved = editing ? await editVehicle(deviceId, payload) : await createVehicle(payload); history.push(`/vehicles/${encodeURIComponent(saved.device_id)}`); }
    catch (reason) { setError(reason instanceof ApiError ? "Please correct the vehicle information." : "Unable to save vehicle."); }
  };
  return <><h1>{editing ? "Edit vehicle" : "Create vehicle"}</h1><form className="vehicle-form" onSubmit={submit}>
    <label>Device ID<input name="device_id" required={!editing} disabled={editing} defaultValue={vehicle?.device_id} pattern="[A-Z0-9][A-Z0-9._-]{0,63}" /></label>
    <label>Plate number<input name="plate_number" required defaultValue={vehicle?.plate_number} /></label>
    <label>Display name<input name="display_name" required defaultValue={vehicle?.display_name} /></label>
    <label>Vehicle type<select name="vehicle_type" defaultValue={vehicle?.vehicle_type ?? "OTHER"}>{vehicleTypes.map(v => <option key={v}>{v}</option>)}</select></label>
    <label>Manufacturer<input name="manufacturer" defaultValue={vehicle?.manufacturer} /></label><label>Model<input name="model" defaultValue={vehicle?.model} /></label>
    <label>Model year<input name="model_year" type="number" min="1980" max={new Date().getUTCFullYear() + 1} defaultValue={vehicle?.model_year ?? ""} /></label>
    <label>Passenger capacity<input name="passenger_capacity" type="number" min="1" max="100" defaultValue={vehicle?.passenger_capacity ?? ""} /></label>
    {error && <p role="alert" className="message message--error">{error}</p>}<button>Save vehicle</button>
  </form></>;
}
function LiveStatus({ deviceId }: { deviceId: string }) {
  const [now, setNow] = useState(() => Date.now()); const { status: vehicle, requestState, realtimeState } = useVehicleStatus(deviceId);
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const latest = vehicle?.latest ?? null; const stale = latest && now - Date.parse(latest.recorded_at) > 60_000;
  const value = (number: number | null, suffix: string) => number === null ? "Unavailable" : `${number.toLocaleString()} ${suffix}`;
  return <section aria-labelledby="pilot-title"><p className="eyebrow">Live MQTT/WebSocket pilot</p><h2 id="pilot-title">Simulated Pilot Data</h2><p>Real-time status: {realtimeState}</p>
    {requestState === "loading" && <p>Loading vehicle status…</p>}{requestState === "error" && !vehicle && <p className="message message--error">Latest-status request failed.</p>}
    {vehicle && !latest && <p>Waiting for the first telemetry event…</p>}{latest && <><span className={stale ? "freshness--stale" : "freshness--fresh"}>{stale ? "Stale telemetry" : "Fresh telemetry"}</span>
      <dl className="telemetry-grid"><div><dt>Speed</dt><dd>{value(latest.gnss_speed_kph, "km/h")}</dd></div><div><dt>RPM</dt><dd>{value(latest.rpm, "rpm")}</dd></div>
        <div><dt>Coolant</dt><dd>{value(latest.coolant_c, "°C")}</dd></div><div><dt>Engine load</dt><dd>{value(latest.engine_load_pct, "%")}</dd></div>
        <div><dt>Driving event</dt><dd>{latest.driving_event.replaceAll("_", " ")}</dd></div><div><dt>Position</dt><dd>{latest.latitude.toFixed(4)}, {latest.longitude.toFixed(4)}</dd></div>
        <div><dt>Recorded at</dt><dd>{new Date(latest.recorded_at).toLocaleString()}</dd></div><div><dt>Received at</dt><dd>{new Date(latest.received_at).toLocaleString()}</dd></div></dl></>}
    <LiveVehicleMap latest={latest} /></section>;
}
function VehicleDetail() {
  const { deviceId = "" } = useParams<{ deviceId: string }>(); const { user } = useAuth(); const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [state, setState] = useState<"loading"|"error"|"missing">("loading");
  useEffect(() => { const controller = new AbortController(); getVehicle(deviceId, controller.signal).then(setVehicle).catch((e: unknown) => setState(e instanceof ApiError && e.status === 404 ? "missing" : "error")); return () => controller.abort(); }, [deviceId]);
  if (!vehicle) return <p role={state === "error" ? "alert" : undefined}>{state === "loading" ? "Loading vehicle…" : state === "missing" ? "Vehicle not found." : "Unable to load vehicle."}</p>;
  const toggle = async () => { const action = vehicle.is_active ? "deactivate" : "reactivate"; if (window.confirm(`Confirm ${action} ${vehicle.device_id}?`)) setVehicle(await changeVehicleStatus(vehicle.device_id, !vehicle.is_active)); };
  return <><div className="page-title"><div><p className="eyebrow">{vehicle.device_id}</p><h1>{vehicle.display_name}</h1></div>
    {user && canEdit(user.role) && <Link className="button" to="edit">Edit</Link>}{user?.role === "SUPER_ADMIN" && <button onClick={() => void toggle()}>{vehicle.is_active ? "Deactivate" : "Reactivate"}</button>}</div>
    <dl className="registry-grid">{Object.entries(vehicle).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{value === null || value === "" ? "Unavailable" : String(value)}</dd></div>)}</dl>
    <LiveStatus deviceId={vehicle.device_id} /></>;
}
export default function App() {
  const secure = (page: React.ReactNode) => <Protected><Shell>{page}</Shell></Protected>;
  return <Switch>
    <Route path="/login" exact><LoginPage /></Route>
    <Route path="/vehicles/new" exact>{secure(<VehicleForm />)}</Route>
    <Route path="/vehicles/:deviceId/edit" exact>{secure(<VehicleForm editing />)}</Route>
    <Route path="/vehicles/:deviceId" exact>{secure(<VehicleDetail />)}</Route>
    <Route path="/vehicles" exact>{secure(<VehicleList />)}</Route>
    <Redirect to="/vehicles" />
  </Switch>;
}
