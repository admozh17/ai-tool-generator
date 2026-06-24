import { prisma } from "./prisma";
import type { ToolName } from "./types";

export interface ToolResult {
  // Resolved parameters actually used (for the audit trail).
  resolvedParams: Record<string, unknown>;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  source: string;
}

function clampLimit(value: unknown, fallback = 25): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), 1), 100);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function listCustomers(
  params: Record<string, unknown>,
): Promise<ToolResult> {
  const riskLevel = asString(params.riskLevel);
  const search = asString(params.search);
  const limit = clampLimit(params.limit);
  const resolvedParams = { riskLevel, search, limit };

  const customers = await prisma.customer.findMany({
    where: {
      ...(riskLevel === "low" || riskLevel === "medium" || riskLevel === "high"
        ? { riskLevel }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return {
    resolvedParams,
    source: "postgres",
    columns: [
      { key: "name", label: "Customer" },
      { key: "email", label: "Email" },
      { key: "riskLevel", label: "Risk" },
      { key: "status", label: "Status" },
      { key: "note", label: "Note" },
    ],
    rows: customers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      riskLevel: c.riskLevel,
      status: c.status,
      note: c.note,
    })),
  };
}

async function listAccounts(
  params: Record<string, unknown>,
): Promise<ToolResult> {
  const status = asString(params.status);
  const limit = clampLimit(params.limit);
  const resolvedParams = { status, limit };

  const accounts = await prisma.account.findMany({
    where:
      status === "active" || status === "frozen" ? { status } : {},
    orderBy: { balance: "desc" },
    take: limit,
    include: { customer: true },
  });

  return {
    resolvedParams,
    source: "postgres",
    columns: [
      { key: "customer", label: "Customer" },
      { key: "type", label: "Type" },
      { key: "balance", label: "Balance" },
      { key: "status", label: "Status" },
    ],
    rows: accounts.map((a) => ({
      id: a.id,
      customer: a.customer.name,
      type: a.type,
      balance: a.balance,
      status: a.status,
    })),
  };
}

async function listTransactions(
  params: Record<string, unknown>,
): Promise<ToolResult> {
  const status = asString(params.status);
  const minAmount = Number(params.minAmount);
  const limit = clampLimit(params.limit);
  const resolvedParams = {
    status,
    minAmount: Number.isFinite(minAmount) ? minAmount : undefined,
    limit,
  };

  const transactions = await prisma.transaction.findMany({
    where: {
      ...(status === "normal" || status === "flagged" ? { status } : {}),
      ...(Number.isFinite(minAmount) ? { amount: { gte: minAmount } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { account: { include: { customer: true } } },
  });

  return {
    resolvedParams,
    source: "postgres",
    columns: [
      { key: "customer", label: "Customer" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount" },
      { key: "type", label: "Type" },
      { key: "status", label: "Status" },
    ],
    rows: transactions.map((t) => ({
      id: t.id,
      customer: t.account.customer.name,
      description: t.description,
      amount: t.amount,
      type: t.type,
      status: t.status,
    })),
  };
}

// Second data source: surfaced from the external risk-scoring microservice
// stub rather than from Postgres.
async function getRiskScores(
  params: Record<string, unknown>,
): Promise<ToolResult> {
  const riskLevel = asString(params.riskLevel);
  const limit = clampLimit(params.limit);
  const resolvedParams = { riskLevel, limit };

  const base = process.env.RISK_SERVICE_BASE_URL || "http://localhost:3000";
  const url = new URL("/api/risk-score", base);
  if (riskLevel) url.searchParams.set("riskLevel", riskLevel);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`risk-service responded ${res.status}`);
  }
  const data = (await res.json()) as {
    scores: {
      customer: string;
      score: number;
      band: string;
      model: string;
    }[];
  };

  return {
    resolvedParams,
    source: "risk-service",
    columns: [
      { key: "customer", label: "Customer" },
      { key: "score", label: "Risk Score" },
      { key: "band", label: "Band" },
      { key: "model", label: "Model" },
    ],
    rows: data.scores,
  };
}

const TOOL_IMPL: Record<
  ToolName,
  (params: Record<string, unknown>) => Promise<ToolResult>
> = {
  listCustomers,
  listAccounts,
  listTransactions,
  getRiskScores,
};

export function runTool(
  tool: ToolName,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  return TOOL_IMPL[tool](params);
}
