import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ApiError } from "./services/api";
import * as auth from "./services/auth";
import type { StaffUser } from "./services/auth";

type AuthState = {
  user: StaffUser | null; loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>; expire: () => void;
};
const Context = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const expire = () => setUser(null);
    window.addEventListener("ftms:session-expired", expire);
    auth.bootstrapCsrf(controller.signal).then(() => auth.me(controller.signal)).then(setUser).catch((error: unknown) => {
      if (!(error instanceof ApiError && error.status === 401)) setUser(null);
    }).finally(() => setLoading(false));
    return () => { controller.abort(); window.removeEventListener("ftms:session-expired", expire); };
  }, []);
  const value = useMemo<AuthState>(() => ({
    user, loading,
    signIn: async (username, password) => setUser(await auth.login(username, password)),
    signOut: async () => { await auth.logout(); setUser(null); },
    expire: () => setUser(null),
  }), [user, loading]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
