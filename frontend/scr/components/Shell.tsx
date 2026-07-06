import { Link, useNavigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../lib/auth";

export default function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line px-6 py-4 flex items-center justify-between">
        <Link to="/dashboard" className="font-display text-lg flex items-center gap-2">
          <span className="inline-block h-2 w-2 bg-copper" />
          Smart Trade Host
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link to="/dashboard" className="hover:text-moss">Dashboard</Link>
          {user && ["ADMIN", "SUPER_ADMIN", "SUPPORT"].includes(user.role) && (
            <Link to="/admin" className="hover:text-moss">Admin</Link>
          )}
          <span className="text-ink/50">{user?.email}</span>
          <button onClick={onLogout} className="text-loss hover:underline">Log out</button>
        </nav>
      </header>
      <main className="px-6 py-8 max-w-5xl mx-auto">{children}</main>
    </div>
  );
}