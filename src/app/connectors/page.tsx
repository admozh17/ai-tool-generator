"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { CONNECTOR_LIST } from "@/lib/connectors";
import type { AuthUser, DataClass } from "@/lib/types";

const CLASS_STYLE: Record<DataClass, string> = {
  PUBLIC: "bg-zinc-100 text-zinc-500",
  PII: "bg-sky-100 text-sky-700",
  FINANCIAL: "bg-violet-100 text-violet-700",
  SENSITIVE: "bg-red-100 text-red-700",
};

export default function ConnectorsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

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
    })();
  }, [router]);

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
        <h1 className="text-xl font-semibold tracking-tight">Connectors</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Governed data sources the generator can build tools over. Every field
          is classified; the{" "}
          <span className="font-medium">PII</span>,{" "}
          <span className="font-medium">FINANCIAL</span> and{" "}
          <span className="font-medium">SENSITIVE</span> columns are masked
          server-side by role at fetch time.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {CONNECTOR_LIST.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">{c.label}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.real
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {c.real ? "live" : "mocked"}
                </span>
              </div>
              <p className="mt-0.5 text-xs font-medium text-zinc-500">
                {c.kind}
              </p>
              <p className="mt-2 text-sm text-zinc-600">{c.description}</p>

              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Fields
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {c.fields.map((f) => (
                    <span
                      key={f.key}
                      className={`rounded-md px-2 py-0.5 text-xs ${CLASS_STYLE[f.classification]}`}
                      title={f.classification}
                    >
                      {f.label}
                      {f.classification !== "PUBLIC" && (
                        <span className="ml-1 text-[9px] font-semibold uppercase">
                          {f.classification}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Tools
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {c.tools.map((t) => (
                    <span
                      key={t}
                      className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-600"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
