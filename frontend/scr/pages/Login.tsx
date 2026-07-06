import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-block h-2 w-2 bg-copper mb-3" />
          <h1 className="font-display text-2xl">Smart Trade Host</h1>
          <p className="text-sm text-ink/60 mt-1">Sign in to your account</p>
        </div>
        <form onSubmit={onSubmit} className="border border-line bg-white/40 p-6 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wide text-ink/60 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-line bg-paper px-3 py-2 focus:outline-none focus:ring-2 focus:ring-moss"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-ink/60 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-line bg-paper px-3 py-2 focus:outline-none focus:ring-2 focus:ring-moss"
            />
          </div>
          {error && <p className="text-loss text-sm">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-moss text-paper py-2 font-medium hover:bg-moss/90 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-center text-sm text-ink/60 mt-4">
          No account? <Link to="/register" className="text-moss underline">Register</Link>
        </p>
      </div>
    </div>
  );
}