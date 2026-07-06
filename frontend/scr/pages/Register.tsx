import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/auth/register", { email, password });
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-xl mb-2">Check your email</h1>
          <p className="text-sm text-ink/60">
            We sent a verification link to {email}. Verify your address, then{" "}
            <Link to="/login" className="text-moss underline">sign in</Link>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-block h-2 w-2 bg-copper mb-3" />
          <h1 className="font-display text-2xl">Create your account</h1>
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
            <label className="block text-xs uppercase tracking-wide text-ink/60 mb-1">Password (min 10 characters)</label>
            <input
              type="password"
              required
              minLength={10}
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
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="text-center text-sm text-ink/60 mt-4">
          Already have an account? <Link to="/login" className="text-moss underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}