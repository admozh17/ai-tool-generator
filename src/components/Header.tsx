"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import type { AuthUser } from "@/lib/types";

export default function Header({ user }: { user: AuthUser }) {
  const router = useRouter();
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const tabs = [
    { href: "/app", label: "Generator" },
    { href: "/connectors", label: "Connectors" },
    { href: "/audit", label: "Audit Log" },
  ];

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold tracking-tight">
            AI Tool Generator
          </span>
          <nav className="flex gap-1">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  pathname === t.href
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-600">{user.email}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              user.role === "admin"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {user.role}
          </span>
          <button
            onClick={logout}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
