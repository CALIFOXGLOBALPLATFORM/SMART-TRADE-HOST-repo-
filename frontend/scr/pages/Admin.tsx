import { useEffect, useState } from "react";
import Shell from "../components/Shell";
import { api } from "../lib/api";

export default function Admin() {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [tab, setTab] = useState<"deposits" | "withdrawals" | "users" | "audit">("deposits");

  async function loadAll() {
    const [d, w, u, l] = await Promise.all([
      api.get("/deposits"),
      api.get("/withdrawals"),
      api.get("/admin/users"),
      api.get("/admin/audit-log"),
    ]);
    setDeposits(d.data.deposits);
    setWithdrawals(w.data.withdrawals);
    setUsers(u.data.users);
    setLogs(l.data.logs);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function reviewDeposit(id: string, status: string) {
    const reason = window.prompt(`Reason for marking this deposit ${status}?`);
    if (!reason) return;
    await api.patch(`/deposits/${id}`, { status, reason });
    loadAll();
  }

  async function reviewWithdrawal(id: string, status: string) {
    const reason = window.prompt(`Reason for marking this withdrawal ${status}?`);
    if (!reason) return;
    await api.patch(`/withdrawals/${id}`, { status, reason });
    loadAll();
  }

  async function reviewKyc(id: string, status: string) {
    const reason = window.prompt(`Reason for KYC ${status}?`);
    if (!reason) return;
    await api.patch(`/admin/users/${id}/kyc`, { status, reason });
    loadAll();
  }

  return (
    <Shell>
      <h1 className="font-display text-2xl mb-2">Admin</h1>
      <p className="text-sm text-ink/60 mb-6">
        Every action here requires a reason and is written to the audit log. There is no control here
        to directly edit a user's balance — money only moves via reviewed deposit/withdrawal requests
        against the real brokerage account.
      </p>

      <div className="flex gap-4 border-b border-line mb-6 text-sm">
        {(["deposits", "withdrawals", "users", "audit"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 capitalize ${tab === t ? "border-b-2 border-moss text-moss" : "text-ink/50"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "deposits" && (
        <Table
          rows={deposits}
          columns={["user.email", "amountUsd", "method", "status", "createdAt"]}
          actions={(row) => (
            <div className="flex gap-2">
              <button onClick={() => reviewDeposit(row.id, "APPROVED")} className="text-moss text-xs hover:underline">Approve</button>
              <button onClick={() => reviewDeposit(row.id, "COMPLETED")} className="text-moss text-xs hover:underline">Complete</button>
              <button onClick={() => reviewDeposit(row.id, "REJECTED")} className="text-loss text-xs hover:underline">Reject</button>
            </div>
          )}
        />
      )}

      {tab === "withdrawals" && (
        <Table
          rows={withdrawals}
          columns={["user.email", "amountUsd", "destination", "status", "createdAt"]}
          actions={(row) => (
            <div className="flex gap-2">
              <button onClick={() => reviewWithdrawal(row.id, "APPROVED")} className="text-moss text-xs hover:underline">Approve</button>
              <button onClick={() => reviewWithdrawal(row.id, "PROCESSING")} className="text-moss text-xs hover:underline">Processing</button>
              <button onClick={() => reviewWithdrawal(row.id, "COMPLETED")} className="text-moss text-xs hover:underline">Complete</button>
              <button onClick={() => reviewWithdrawal(row.id, "REJECTED")} className="text-loss text-xs hover:underline">Reject</button>
            </div>
          )}
        />
      )}

      {tab === "users" && (
        <Table
          rows={users}
          columns={["email", "role", "kycStatus", "emailVerified", "createdAt"]}
          actions={(row) => (
            <div className="flex gap-2">
              <button onClick={() => reviewKyc(row.id, "APPROVED")} className="text-moss text-xs hover:underline">Approve KYC</button>
              <button onClick={() => reviewKyc(row.id, "REJECTED")} className="text-loss text-xs hover:underline">Reject KYC</button>
            </div>
          )}
        />
      )}

      {tab === "audit" && (
        <Table
          rows={logs}
          columns={["actor.email", "subject.email", "action", "reason", "createdAt"]}
        />
      )}
    </Shell>
  );
}

function get(obj: any, path: string) {
  return path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj) ?? "—";
}

function Table({
  rows,
  columns,
  actions,
}: {
  rows: any[];
  columns: string[];
  actions?: (row: any) => JSX.Element;
}) {
  return (
    <table className="w-full text-sm border border-line">
      <thead className="bg-white/40 text-left">
        <tr>
          {columns.map((c) => (
            <th key={c} className="px-3 py-2 capitalize">{c.split(".").pop()}</th>
          ))}
          {actions && <th className="px-3 py-2">Actions</th>}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr><td className="px-3 py-4 text-ink/40" colSpan={columns.length + 1}>Nothing here yet.</td></tr>
        )}
        {rows.map((row) => (
          <tr key={row.id} className="border-t border-line">
            {columns.map((c) => (
              <td key={c} className="px-3 py-2">{String(get(row, c))}</td>
            ))}
            {actions && <td className="px-3 py-2">{actions(row)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}