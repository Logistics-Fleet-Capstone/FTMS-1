import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from "react-leaflet";
import type { TransportRequestBase, TransportRoute } from "../types";

const fallbackCenter: [number, number] = [14.5652, 121.0286];
const fallbackZoom = 13;

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => { map.fitBounds(points, { padding: [35, 35] }); }, [map, points]);
  return null;
}

function DefaultView({ active }: { active: boolean }) {
  const map = useMap();
  useEffect(() => { if (!active) map.setView(fallbackCenter, fallbackZoom); }, [active, map]);
  return null;
}

function ResizeMap() {
  const map = useMap();
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(map.getContainer()); return () => observer.disconnect();
  }, [map]);
  return null;
}

export default function RequestMap({ request, route, routeState }: { request: TransportRequestBase | null; route?: TransportRoute | null; routeState?: "idle" | "loading" | "ready" | "error" }) {
  const tomTomKey = import.meta.env.VITE_TOMTOM_MAPS_KEY?.trim() ?? "";
  const [trafficEnabled, setTrafficEnabled] = useState(true); const [incidentsEnabled, setIncidentsEnabled] = useState(true); const [tileError, setTileError] = useState(false);
  const pickup: [number, number] = request ? [Number(request.pickup_latitude), Number(request.pickup_longitude)] : fallbackCenter;
  const destination: [number, number] | null = request ? [Number(request.destination_latitude), Number(request.destination_longitude)] : null;
  const markerPoints: [number, number][] | null = destination ? [pickup, destination] : null;
  const routePoints: [number, number][] = route?.geometry?.coordinates?.map(([longitude, latitude]) => [latitude, longitude]) ?? [];
  const fitPoints = routePoints.length >= 2 && markerPoints ? [...routePoints, ...markerPoints] : markerPoints;
  const encodedKey = encodeURIComponent(tomTomKey);
  const baseTiles = `https://api.tomtom.com/maps/orbis/display/raster/tile/{z}/{x}/{y}?apiVersion=2&key=${encodedKey}&style=street-light&tileSize=256`;
  const trafficTiles = `https://api.tomtom.com/maps/orbis/traffic/flow/raster/tile/{z}/{x}/{y}?apiVersion=2&key=${encodedKey}&style=light&tileSize=256`;
  const incidentTiles = `https://api.tomtom.com/maps/orbis/traffic/incidents/raster/tile/{z}/{x}/{y}?apiVersion=2&key=${encodedKey}&style=light&tileSize=256`;
  const tileEvents = { tileerror: () => setTileError(true) };

  return <div className={`request-map tomtom-request-map ${request ? "" : "request-map--empty"}`}><MapContainer center={pickup} zoom={fallbackZoom} scrollWheelZoom={false}>
    {tomTomKey && <TileLayer attribution='&copy; TomTom' url={baseTiles} maxZoom={22} eventHandlers={tileEvents} />}
    {tomTomKey && trafficEnabled && <TileLayer attribution='&copy; TomTom Traffic' url={trafficTiles} maxZoom={22} opacity={1} eventHandlers={tileEvents} />}
    {tomTomKey && incidentsEnabled && <TileLayer attribution='&copy; TomTom Traffic' url={incidentTiles} maxZoom={22} opacity={1} eventHandlers={tileEvents} />}
    <DefaultView active={Boolean(request)} /><ResizeMap />
    {request && destination && markerPoints && <><CircleMarker center={pickup} radius={9} pathOptions={{ color: "#8f1d2c", fillOpacity: 1 }} /><CircleMarker center={destination} radius={9} pathOptions={{ color: "#247058", fillOpacity: 1 }} />{routePoints.length >= 2 && <Polyline positions={routePoints} pathOptions={{ color: "#8f1d2c", weight: 5, opacity: 0.85 }} />}<Fit points={fitPoints ?? markerPoints} /></>}
  </MapContainer>
    {!tomTomKey && <div className="request-map-state" role="alert">TomTom map key is not configured.</div>}
    {tomTomKey && tileError && <div className="request-map-tile-error" role="alert">Unable to load TomTom map tiles.</div>}
    {tomTomKey && <div className="map-layer-controls" aria-label="Map overlays"><button type="button" aria-pressed={trafficEnabled} onClick={() => setTrafficEnabled(value => !value)}>Traffic {trafficEnabled ? "on" : "off"}</button><button type="button" aria-pressed={incidentsEnabled} onClick={() => setIncidentsEnabled(value => !value)}>Incidents {incidentsEnabled ? "on" : "off"}</button></div>}
    {request && routeState === "loading" && <div className="request-route-state" role="status">Calculating route…</div>}
    {request && routeState === "error" && <div className="request-route-state request-route-state--error" role="status">Route unavailable</div>}
    {request ? <div className="map-legend"><span><i className="pickup-dot" />{request.pickup_name}</span><span><i className="destination-dot" />{request.destination_name}</span></div> : <div className="request-map-empty-overlay">No request selected</div>}
  </div>;
}
