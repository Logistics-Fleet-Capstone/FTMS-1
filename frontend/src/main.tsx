import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import App from "./App";
import TransportRequestsRoute from "./TransportRequestsRoute";
import "leaflet/dist/leaflet.css";

function RootRoutes() {
  const location = useLocation();
  return location.pathname.startsWith("/transport-requests")
    ? <TransportRequestsRoute />
    : <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter><AuthProvider><RootRoutes /></AuthProvider></BrowserRouter>
  </StrictMode>,
);
