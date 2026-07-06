import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api, setAccessToken, getAccessToken } from "./api";

interface User {
  id: string;
  email: string;
  role: string;
  kycStatus: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On load, if we have a token, try to refresh it so a page reload
    // doesn't just silently log the user out.
    (async () => {
      if (getAccessToken()) {
        try {
          const { data } = await api.post("/auth/refresh");
          setAccessToken(data.accessToken);
        } catch {
          setAccessToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  async function login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
  }

  async function logout() {
    await api.post("/auth/logout");
    setAccessToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}