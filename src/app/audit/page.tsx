"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import type { AuthUser } from "@/lib/types";

interface AuditRow {
  id: string;
  userEmail: string;
  role: string;
  kind: string;
  name: string;
  params: unknown;
  targetType: string | null;
  targetId: string | null;
  outcome: string;
  createdAt: string;
}

const KIND_STYLE: Record<string, string> = {
  data_fetch: "bg-sky-100 text-sky-700",
  action: "bg-indigo-100 text-indigo-700",
  generation: "bg-zinc-100 text-zinc-700",
};

export default function AuditPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [scope, setScope] = useState<string>("");
  const [checking, setChecking] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/audit");
    if (!res.ok) return;
    const data = await res.json();
    setRows(data.logs);
    setScope(data.scope);
  }, []);

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me");
      if (!me.ok) {
        router.push("/login");
        return;
      }
      const data = await me.json();
      setUser(data.user);
      setChecking(false);
      await load();
    })();
  }, [router, load]);

  if (checking || !user) {
    return (
      <main className="flex flex-1 items-center justify-center text-sm text-zinc-400">
        Loading…
      </main>
    );
  }

  return (
    <>
      <Header user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Audit Log</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Append-only record of every generation, data fetch and write
              action.{" "}
              {scope === "all"
                ? "Admin view: all users."
                : "Viewer view: your activity only."}
            </p>
          </div>
          <button
            onClick={load}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Kind</th>
                <th className="px-3 py-2 font-medium">Resolved name</th>
                <th className="px-3 py-2 font-medium">Params</th>
                <th className="px-3 py-2 font-medium">Target</th>
                <th className="px-3 py-2 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-zinc-400">
                    No audit rows yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-zinc-50 align-top hover:bg-zinc-50"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.userEmail}</td>
                    <td className="px-3 py-2 text-xs">{r.role}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          KIND_STYLE[r.kind] ?? "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {r.kind}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.name}</td>
                    <td className="max-w-xs px-3 py-2">
                      <code className="block whitespace-pre-wrap break-words text-xs text-zinc-600">
                        {JSON.stringify(r.params)}
                      </code>
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-500">
                      {r.targetType ? `${r.targetType}:${r.targetId}` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.outcome === "denied"
                            ? "bg-red-100 text-red-700"
                            : r.outcome === "error"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {r.outcome}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
