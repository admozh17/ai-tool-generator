"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function login(emailValue: string, passwordValue: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue, password: passwordValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed.");
        return;
      }
      router.push("/app");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">
          AI Tool Generator
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Sign in to compose governed internal tools.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            login(email, password);
          }}
        >
          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 border-t border-zinc-100 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Seeded demo users
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => login("admin@example.com", "admin123")}
              disabled={loading}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-left text-xs hover:bg-zinc-50 disabled:opacity-50"
            >
              <span className="block font-semibold">admin</span>
              <span className="text-zinc-500">admin@example.com</span>
            </button>
            <button
              onClick={() => login("viewer@example.com", "viewer123")}
              disabled={loading}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-left text-xs hover:bg-zinc-50 disabled:opacity-50"
            >
              <span className="block font-semibold">viewer</span>
              <span className="text-zinc-500">viewer@example.com</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
