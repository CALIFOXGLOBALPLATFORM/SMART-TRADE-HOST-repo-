import { useEffect, useState, FormEvent } from "react";
import Shell from "../components/Shell";
import { api } from "../lib/api";

interface Account {
  cash: number;
  portfolioValue: number;
  buyingPower: number;
  currency: string;
}
interface Position {
  symbol: string;
  qty: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPl: number;
  unrealizedPlPct: number;
}

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function Dashboard() {
  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawDest, setWithdrawDest] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function loadPortfolio() {
    try {
      const { data } = await api.get("/portfolio");
      setAccount(data.account);
      setPositions(data.positions);
      setPortfolioError(null);
    } catch (err: any) {
      setPortfolioError(
        err.response?.data?.error === "Could not reach broker"
          ? "Broker not configured yet — add ALPACA_API_KEY/SECRET in backend/.env to see live data."
          : "Could not load portfolio."
      );
    }
  }

  useEffect(() => {
    loadPortfolio();
  }, []);

  async function submitDeposit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api.post("/deposits", { amountUsd: parseFloat(depositAmount), method: "bank_ach" });
      setMsg("Deposit request submitted.");
      setDepositAmount("");
    } catch (err: any) {
      setMsg(err.response?.data?.error ?? "Deposit request failed.");
    }
  }

  async function submitWithdrawal(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api.post("/withdrawals", {
        amountUsd: parseFloat(withdrawAmount),
        method: "bank_ach",
        destination: withdrawDest,
      });
      setMsg("Withdrawal request submitted for review.");
      setWithdrawAmount("");
      setWithdrawDest("");
    } catch (err: any) {
      setMsg(err.response?.data?.error ?? "Withdrawal request failed.");
    }
  }

  return (
    <Shell>
      <h1 className="font-display text-2xl mb-6">Portfolio</h1>

      {portfolioError && (
        <div className="border border-copper/40 bg-copper/5 text-copper px-4 py-3 mb-6 text-sm">
          {portfolioError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total value" value={account ? fmt(account.portfolioValue) : "—"} />
        <StatCard label="Available cash" value={account ? fmt(account.cash) : "—"} />
        <StatCard label="Buying power" value={account ? fmt(account.buyingPower) : "—"} />
      </div>

      <section className="mb-10">
        <h2 className="font-display text-lg mb-3">Positions</h2>
        {positions.length === 0 ? (
          <p className="text-sm text-ink/50">No open positions yet.</p>
        ) : (
          <table className="w-full text-sm border border-line">
            <thead className="bg-white/40 text-left">
              <tr>
                <th className="px-3 py-2">Symbol</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Avg entry</th>
                <th className="px-3 py-2">Current price</th>
                <th className="px-3 py-2">Market value</th>
                <th className="px-3 py-2">Unrealized P/L</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.symbol} className="border-t border-line num">
                  <td className="px-3 py-2 font-mono">{p.symbol}</td>
                  <td className="px-3 py-2">{p.qty}</td>
                  <td className="px-3 py-2">{fmt(p.avgEntryPrice)}</td>
                  <td className="px-3 py-2">{fmt(p.currentPrice)}</td>
                  <td className="px-3 py-2">{fmt(p.marketValue)}</td>
                  <td className={`px-3 py-2 ${p.unrealizedPl >= 0 ? "text-moss" : "text-loss"}`}>
                    {fmt(p.unrealizedPl)} ({p.unrealizedPlPct.toFixed(2)}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {msg && <div className="border border-line bg-white/40 px-4 py-3 mb-6 text-sm">{msg}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <form onSubmit={submitDeposit} className="border border-line p-5">
          <h3 className="font-display text-base mb-3">Request a deposit</h3>
          <label className="block text-xs uppercase tracking-wide text-ink/60 mb-1">Amount (USD)</label>
          <input
            type="number"
            min="1"
            step="0.01"
            required
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            className="w-full border border-line bg-paper px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-moss"
          />
          <button className="bg-moss text-paper px-4 py-2 text-sm font-medium hover:bg-moss/90">
            Submit deposit request
          </button>
        </form>

        <form onSubmit={submitWithdrawal} className="border border-line p-5">
          <h3 className="font-display text-base mb-3">Request a withdrawal</h3>
          <label className="block text-xs uppercase tracking-wide text-ink/60 mb-1">Amount (USD)</label>
          <input
            type="number"
            min="1"
            step="0.01"
            required
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            className="w-full border border-line bg-paper px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-moss"
          />
          <label className="block text-xs uppercase tracking-wide text-ink/60 mb-1">Bank account (masked)</label>
          <input
            type="text"
            required
            value={withdrawDest}
            onChange={(e) => setWithdrawDest(e.target.value)}
            placeholder="****1234"
            className="w-full border border-line bg-paper px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-moss"
          />
          <button className="bg-ink text-paper px-4 py-2 text-sm font-medium hover:bg-ink/90">
            Submit withdrawal request
          </button>
        </form>
      </div>
    </Shell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line p-5">
      <p className="text-xs uppercase tracking-wide text-ink/50 mb-1">{label}</p>
      <p className="font-display text-2xl num">{value}</p>
    </div>
  );
}