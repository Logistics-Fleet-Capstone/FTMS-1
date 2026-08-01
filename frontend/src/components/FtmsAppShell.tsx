import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";
import "./FtmsAppShell.css";

type ShellItem = { label: string; to?: string; count?: string };
const groups: Array<{ title: string; items: ShellItem[] }> = [
  { title: "Main", items: [{ label:"Home", to:"/vehicles" }, { label:"Live Map" }, { label:"Vehicles", to:"/vehicles" }, { label:"Drivers" }, { label:"Safety", count:"4" }, { label:"Alerts", count:"7" }] },
  { title: "Jobs & Routes", items: [{ label:"Operations Prototype", to:"/operations-prototype" }, { label:"Route Planning" }, { label:"Calendar" }] },
  { title: "Intelligence", items: [{ label:"Analytics" }, { label:"Maintenance" }, { label:"Reports" }] },
  { title: "Administration", items: [{ label:"Devices" }, { label:"Settings" }] },
];

export default function FtmsAppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth(); const location = useLocation();
  const [time, setTime] = useState(""); const [logoutBusy, setLogoutBusy] = useState(false); const [logoutError, setLogoutError] = useState("");
  const mounted = useRef(true); const logoutInFlight = useRef(false);
  useEffect(() => { mounted.current = true; const update = () => setTime(new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit" })); update(); const timer = window.setInterval(update,1000); return () => { mounted.current=false; clearInterval(timer); }; }, []);
  const logout = async () => { if(logoutInFlight.current)return; logoutInFlight.current=true; setLogoutBusy(true); setLogoutError(""); try{await signOut();}catch{if(mounted.current)setLogoutError("Unable to sign out. Please try again.");}finally{logoutInFlight.current=false;if(mounted.current)setLogoutBusy(false);} };
  return <div className="fc-shell"><header className="fc-topbar"><Link className="fc-brand" to="/vehicles"><span>FT<br/>MS</span><span><strong>Fleet Command</strong><small>Logistics 2 Operations</small></span></Link><div className="fc-client-logo"><img src="/client-logo.png" alt="Oxford Suites Makati" /></div><div className="fc-top-actions"><b>{time || "--:--:--"}</b><button title="Notifications" disabled>◌</button><button title="Help">?</button><details><summary>{user?.display_name.split(" ").map(part=>part[0]).slice(0,2).join("")}</summary><div><strong>{user?.display_name}</strong><small>{user?.role.replaceAll("_"," ")}</small><button disabled={logoutBusy} onClick={()=>void logout()}>{logoutBusy?"Signing out…":"Sign out"}</button></div></details></div></header>
    <aside className="fc-sidebar"><div className="fc-nav-search"><span>Search</span><input type="search" aria-label="Search navigation" /></div>{groups.map(group=><section key={group.title}><h2>{group.title}</h2>{group.items.map(item=>item.to?<Link key={item.label} to={item.to} className={location.pathname.startsWith(item.to)&&!(item.to==="/vehicles"&&location.pathname.startsWith("/transport"))?"active":""}><i>□</i><span>{item.label}</span>{item.count&&<b>{item.count}</b>}</Link>:<button key={item.label} disabled title={`${item.label} is planned`}><i>□</i><span>{item.label}</span>{item.count&&<b>{item.count}</b>}</button>)}</section>)}</aside>
    <main className="fc-main">{logoutError&&<p className="fc-error" role="alert">{logoutError}</p>}<div className="fc-page">{children}</div></main>
  </div>;
}
