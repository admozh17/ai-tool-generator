"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import ToolRenderer from "@/components/ToolRenderer";
import type { AuthUser, GenerateResponse, ToolSpec } from "@/lib/types";

const EXAMPLES = [
  "Show me high-risk customers with a freeze button",
  "List flagged transactions over 8000 so I can review them",
  "Show accounts and let me freeze the risky ones",
  "Give me model risk scores for high-risk customers",
];

export default function AppPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  const [prompt, setPrompt] = useState("");
  const [spec, setSpec] = useState<ToolSpec | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setUser(data.user);
      setChecking(false);
    })();
  }, [router]);

  async function generate(text: string) {
    const value = text.trim();
    if (!value) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: value }),
      });
      const data: GenerateResponse & { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed.");
        return;
      }
      setSpec(data.spec);
      setSource(data.source);
    } finally {
      setGenerating(false);
    }
  }

  if (checking) {
    return (
      <main className="flex flex-1 items-center justify-center text-sm text-zinc-400">
        Loading…
      </main>
    );
  }
  if (!user) return null;

  return (
    <>
      <Header user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h1 className="text-xl font-semibold tracking-tight">
            Describe the internal tool you need
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Your request is composed from a fixed registry of governed
            components and actions — never free-form code or SQL.
          </p>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              generate(prompt);
            }}
          >
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. show me high-risk customers with a freeze button"
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            />
            <button
              type="submit"
              disabled={generating}
              className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {generating ? "Generating…" : "Generate"}
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setPrompt(ex);
                  generate(ex);
                }}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
              >
                {ex}
              </button>
            ))}
          </div>

          {source && (
            <p className="mt-3 text-xs text-zinc-400">
              Composed by:{" "}
              <span className="font-medium text-zinc-600">
                {source === "llm" ? "LLM (function-calling)" : "rule-based composer"}
              </span>
              . Role <span className="font-medium">{user.role}</span> governs
              which actions are included.
            </p>
          )}
          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <div className="mt-6">
          {spec ? (
            <ToolRenderer spec={spec} />
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-400">
              Your generated tool will render here.
            </div>
          )}
        </div>
      </main>
    </>
  );
}
