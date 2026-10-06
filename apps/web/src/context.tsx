import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, send, type User } from "./api";
import { ErrorBox, Loading } from "./ui";
import { DateTime } from "luxon";
type Context = {
  user: User | null;
  zone: string;
  clinicName: string;
  login: (email: string, password: string, name?: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
};
const AuthContext = createContext<Context>(null!);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [zone, setZone] = useState("Asia/Riyadh"),
    [error, setError] = useState(""),
    [clinicName, setClinicName] = useState("Clearwell Clinic"),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const expire = () => {
      sessionStorage.removeItem("clinic-token");
      setUser(null);
    };
    window.addEventListener("session-expired", expire);
    (async () => {
      setError("");
      setLoading(true);
      try {
        const config = await api("/config");
        setZone(config.timezone);
        setClinicName(config.name);
        if (sessionStorage.getItem("clinic-token")) {
          try {
            setUser(await api("/auth/me"));
          } catch (e) {
            if ((e as any).status !== 401) throw e;
          }
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
    return () => window.removeEventListener("session-expired", expire);
  }, [retry]);
  const login = async (email: string, password: string, name?: string) => {
    const result = await send(name ? "/auth/register" : "/auth/login", {
      email,
      password,
      ...(name ? { name } : {}),
    });
    sessionStorage.setItem("clinic-token", result.token);
    setUser(result.user);
    return result.user;
  };
  const logout = async () => {
    try {
      await send("/auth/logout");
    } finally {
      sessionStorage.removeItem("clinic-token");
      setUser(null);
    }
  };
  if (loading)
    return (
      <div className="startup">
        <Loading text="Connecting to the clinic…" />
      </div>
    );
  if (error)
    return (
      <div className="startup">
        <div>
          <h1>We couldn’t connect</h1>
          <ErrorBox message={error} retry={() => setRetry((v) => v + 1)} />
        </div>
      </div>
    );
  return (
    <AuthContext.Provider
      value={{ user, zone, clinicName, login, logout, updateUser: setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
export const formatDate = (
  value: string,
  zone: string,
  fmt = "ccc, d LLL yyyy",
) => DateTime.fromISO(value, { zone }).toFormat(fmt);
export const today = (zone: string) =>
  DateTime.now().setZone(zone).toISODate()!;
export const landing = (user: User) =>
  user.role === "PATIENT"
    ? "/doctors"
    : `/${user.role.toLowerCase()}/dashboard`;
