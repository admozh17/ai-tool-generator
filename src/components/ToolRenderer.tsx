"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ComposedAction,
  ComposedComponent,
  DataClass,
  MaskingEntry,
  ResultColumn,
  Role,
  ToolSpec,
} from "@/lib/types";
import { generateToolCode, type GeneratedFile } from "@/lib/codegen";

interface ToolData {
  columns: ResultColumn[];
  rows: Record<string, unknown>[];
  masking?: MaskingEntry[];
  source: string;
  error?: string;
}

const CLASS_STYLE: Record<DataClass, string> = {
  PUBLIC: "bg-zinc-100 text-zinc-500",
  PII: "bg-sky-100 text-sky-700",
  FINANCIAL: "bg-violet-100 text-violet-700",
  SENSITIVE: "bg-red-100 text-red-700",
};

function ClassChip({ column }: { column: ResultColumn }) {
  if (column.classification === "PUBLIC") return null;
  return (
    <span
      className={`ml-1 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${CLASS_STYLE[column.classification]}`}
      title={`${column.classification}${column.masked ? " — masked for your role" : ""}`}
    >
      {column.masked ? `🔒 ${column.classification}` : column.classification}
    </span>
  );
}

interface PendingAction {
  action: ComposedAction;
  row: Record<string, unknown>;
}

function fmt(value: unknown): string {
  if (typeof value === "number") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function Badge({ value }: { value: string }) {
  const v = value.toLowerCase();
  const cls =
    v === "high" || v === "frozen" || v === "flagged" || v === "critical"
      ? "bg-red-100 text-red-700"
      : v === "medium" || v === "elevated"
        ? "bg-amber-100 text-amber-700"
        : "bg-emerald-100 text-emerald-700";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {value}
    </span>
  );
}

const BADGE_KEYS = new Set(["riskLevel", "status", "band"]);

async function fetchToolData(
  tool: string,
  params: Record<string, unknown>,
): Promise<ToolData> {
  const res = await fetch("/api/tools/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, params }),
  });
  const json = await res.json();
  if (!res.ok) {
    return { columns: [], rows: [], source: "", error: json.error };
  }
  return json as ToolData;
}

export default function ToolRenderer({
  spec,
  role,
  onActivity,
}: {
  spec: ToolSpec;
  role: Role;
  onActivity?: () => void;
}) {
  const [view, setView] = useState<"preview" | "code">("preview");
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{spec.title}</h2>
            <p className="mt-1 text-sm text-zinc-600">{spec.summary}</p>
          </div>
          <div className="flex shrink-0 rounded-lg border border-zinc-200 p-0.5 text-xs">
            <button
              onClick={() => setView("preview")}
              className={`rounded-md px-3 py-1 font-medium ${view === "preview" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
            >
              Preview
            </button>
            <button
              onClick={() => setView("code")}
              className={`rounded-md px-3 py-1 font-medium ${view === "code" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
            >
              Code
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {spec.components.map((c) => (
            <span
              key={c.id}
              className="rounded-full bg-zinc-100 px-2 py-1 font-medium text-zinc-700"
            >
              {c.component} ← {c.tool}
            </span>
          ))}
          {spec.actions.map((a) => (
            <span
              key={a.action}
              className="rounded-full bg-indigo-100 px-2 py-1 font-medium text-indigo-700"
            >
              action: {a.action}
            </span>
          ))}
        </div>
        {spec.notes.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            {spec.notes.map((n, i) => (
              <li key={i}>• {n}</li>
            ))}
          </ul>
        )}
      </div>

      {view === "code" ? (
        <CodeView spec={spec} role={role} />
      ) : (
        spec.components.map((component) => (
          <ComponentBlock
            key={component.id}
            component={component}
            actions={spec.actions.filter(
              (a) => a.appliesTo === component.component,
            )}
            onActivity={onActivity}
          />
        ))
      )}
    </div>
  );
}

function CodeView({ spec, role }: { spec: ToolSpec; role: Role }) {
  const files = useMemo<GeneratedFile[]>(
    () => generateToolCode(spec, role),
    [spec, role],
  );
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const file = files[active];

  async function copy() {
    try {
      await navigator.clipboard.writeText(file.contents);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {files.map((f, i) => (
            <button
              key={f.filename}
              onClick={() => setActive(i)}
              className={`rounded-md px-2.5 py-1 font-mono text-xs ${i === active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
            >
              {f.filename}
            </button>
          ))}
        </div>
        <button
          onClick={copy}
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="px-4 pb-2 pt-3">
        <p className="text-xs text-zinc-400">
          Ejected from your composition for role{" "}
          <span className="font-medium text-zinc-600">{role}</span>. The generated
          code calls the same governed endpoints — masking and write permissions
          stay enforced server-side.
        </p>
      </div>
      <pre className="max-h-[480px] overflow-auto rounded-b-xl bg-zinc-950 px-4 py-4 text-xs leading-relaxed text-zinc-100">
        <code>{file.contents}</code>
      </pre>
    </div>
  );
}

function ComponentBlock({
  component,
  actions,
  onActivity,
}: {
  component: ComposedComponent;
  actions: ComposedAction[];
  onActivity?: () => void;
}) {
  const [data, setData] = useState<ToolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [noteText, setNoteText] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const reload = useCallback(async () => {
    const next = await fetchToolData(component.tool, component.params);
    setData(next);
    setLoading(false);
    onActivity?.();
  }, [component.tool, component.params, onActivity]);

  useEffect(() => {
    let active = true;
    fetchToolData(component.tool, component.params).then((next) => {
      if (!active) return;
      setData(next);
      setLoading(false);
      onActivity?.();
    });
    return () => {
      active = false;
    };
  }, [component.tool, component.params, onActivity]);

  async function confirmAction() {
    if (!pending) return;
    setWorking(true);
    const params: Record<string, unknown> = { id: pending.row.id };
    if (pending.action.action === "addCustomerNote") params.note = noteText;
    const res = await fetch("/api/actions/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: pending.action.action, params }),
    });
    const json = await res.json();
    setWorking(false);
    setPending(null);
    setNoteText("");
    setToast(res.ok ? json.message : `Denied: ${json.error}`);
    onActivity?.();
    setLoading(true);
    await reload();
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">{component.title}</h3>
          <p className="text-xs text-zinc-400">
            {component.component} · source: {data?.source || "…"}
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            reload();
          }}
          className="text-xs text-zinc-500 hover:text-zinc-900"
        >
          Refresh
        </button>
      </div>

      {data?.masking?.some((m) => m.action === "masked") && (
        <div className="mx-4 mt-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
          🔒 Governed:{" "}
          {data.masking
            .filter((m) => m.action === "masked")
            .map((m) => `${m.field} (${m.classification})`)
            .join(", ")}{" "}
          masked server-side for your role.
        </div>
      )}

      {toast && (
        <div className="mx-4 mt-3 rounded-lg bg-zinc-900 px-3 py-2 text-xs text-white">
          {toast}
        </div>
      )}

      <div className="p-4">
        {loading ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : data?.error ? (
          <p className="text-sm text-red-600">{data.error}</p>
        ) : component.component === "AccountCards" ? (
          <CardGrid data={data!} actions={actions} onAct={setPending} />
        ) : (
          <DataTable data={data!} actions={actions} onAct={setPending} />
        )}
      </div>

      {pending && (
        <ConfirmModal
          pending={pending}
          noteText={noteText}
          setNoteText={setNoteText}
          working={working}
          onCancel={() => {
            setPending(null);
            setNoteText("");
          }}
          onConfirm={confirmAction}
        />
      )}
    </div>
  );
}

function ActionButtons({
  actions,
  row,
  onAct,
}: {
  actions: ComposedAction[];
  row: Record<string, unknown>;
  onAct: (p: PendingAction) => void;
}) {
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {actions.map((a) => (
        <button
          key={a.action}
          onClick={() => onAct({ action: a, row })}
          className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

function DataTable({
  data,
  actions,
  onAct,
}: {
  data: ToolData;
  actions: ComposedAction[];
  onAct: (p: PendingAction) => void;
}) {
  if (data.rows.length === 0)
    return <p className="text-sm text-zinc-400">No rows.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
            {data.columns.map((c) => (
              <th key={c.key} className="whitespace-nowrap px-2 py-2 font-medium">
                {c.label}
                <ClassChip column={c} />
              </th>
            ))}
            {actions.length > 0 && <th className="px-2 py-2 font-medium" />}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} className="border-b border-zinc-50 hover:bg-zinc-50">
              {data.columns.map((c) => (
                <td key={c.key} className="px-2 py-2">
                  {BADGE_KEYS.has(c.key) ? (
                    <Badge value={fmt(row[c.key])} />
                  ) : (
                    fmt(row[c.key])
                  )}
                </td>
              ))}
              {actions.length > 0 && (
                <td className="px-2 py-2 text-right">
                  <ActionButtons actions={actions} row={row} onAct={onAct} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CardGrid({
  data,
  actions,
  onAct,
}: {
  data: ToolData;
  actions: ComposedAction[];
  onAct: (p: PendingAction) => void;
}) {
  if (data.rows.length === 0)
    return <p className="text-sm text-zinc-400">No rows.</p>;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.rows.map((row, i) => (
        <div
          key={i}
          className="rounded-lg border border-zinc-200 p-3 text-sm"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">{fmt(row.customer)}</span>
            <Badge value={fmt(row.status)} />
          </div>
          <p className="mt-1 text-xs text-zinc-500 capitalize">
            {fmt(row.type)}
          </p>
          <p className="mt-2 text-lg font-semibold">${fmt(row.balance)}</p>
          <div className="mt-3">
            <ActionButtons actions={actions} row={row} onAct={onAct} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ConfirmModal({
  pending,
  noteText,
  setNoteText,
  working,
  onCancel,
  onConfirm,
}: {
  pending: PendingAction;
  noteText: string;
  setNoteText: (v: string) => void;
  working: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const label = pending.action.label;
  const subject =
    pending.row.customer ?? pending.row.name ?? pending.row.description;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">Confirm: {label}</h3>
        <p className="mt-2 text-sm text-zinc-600">
          This is a write-back action. It will be authorized server-side against
          your role and recorded in the audit log.
        </p>
        <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-sm">
          Target: <span className="font-medium">{fmt(subject)}</span>
        </p>

        {pending.action.action === "addCustomerNote" && (
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Review note…"
            className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            rows={3}
          />
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={working}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={working}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {working ? "Working…" : `Confirm ${label}`}
          </button>
        </div>
      </div>
    </div>
  );
}
