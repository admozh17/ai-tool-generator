import { prisma } from "./prisma";
import { connectorBaseUrl } from "./connectors";
import type { ResultColumn, ToolName } from "./types";

export interface ToolResult {
  // Resolved parameters actually used (for the audit trail).
  resolvedParams: Record<string, unknown>;
  columns: ResultColumn[];
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

function asRisk(value: unknown): "low" | "medium" | "high" | undefined {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : undefined;
}

async function listCustomers(
  params: Record<string, unknown>,
): Promise<ToolResult> {
  const riskLevel = asRisk(params.riskLevel);
  const search = asString(params.search);
  const limit = clampLimit(params.limit);
  const resolvedParams = { riskLevel, search, limit };

  const customers = await prisma.customer.findMany({
    where: {
      ...(riskLevel ? { riskLevel } : {}),
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
      { key: "name", label: "Customer", classification: "PUBLIC" },
      { key: "email", label: "Email", classification: "PII" },
      { key: "ssn", label: "SSN", classification: "SENSITIVE" },
      { key: "riskLevel", label: "Risk", classification: "PUBLIC" },
      { key: "status", label: "Status", classification: "PUBLIC" },
      { key: "note", label: "Note", classification: "PUBLIC" },
    ],
    rows: customers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      ssn: c.ssn,
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
    where: status === "active" || status === "frozen" ? { status } : {},
    orderBy: { balance: "desc" },
    take: limit,
    include: { customer: true },
  });

  return {
    resolvedParams,
    source: "postgres",
    columns: [
      { key: "customer", label: "Customer", classification: "PUBLIC" },
      { key: "type", label: "Type", classification: "PUBLIC" },
      { key: "balance", label: "Balance", classification: "FINANCIAL" },
      { key: "status", label: "Status", classification: "PUBLIC" },
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
      { key: "customer", label: "Customer", classification: "PUBLIC" },
      { key: "description", label: "Description", classification: "PUBLIC" },
      { key: "amount", label: "Amount", classification: "FINANCIAL" },
      { key: "type", label: "Type", classification: "PUBLIC" },
      { key: "status", label: "Status", classification: "PUBLIC" },
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

// ---------------------------------------------------------------------------
// Connector clients. Each hits a governed endpoint over the network, exactly
// as a real Redshift/BigQuery/REST client would. Swapping the mock route for a
// real driver is isolated to these fetches.
// ---------------------------------------------------------------------------
interface RiskRow {
  customerId: string;
  customer: string;
  score: number;
  band: string;
  model: string;
}
interface ActivityRow {
  customerId: string;
  customer: string;
  lastSeen: string;
  sessions30d: number;
  ipAddress: string;
  country: string;
}
interface SpendRow {
  customerId: string;
  customer: string;
  lifetimeSpend: number;
  topCategory: string;
  ltvBand: string;
}

async function fetchConnector<T>(
  path: string,
  params: Record<string, string | undefined>,
  key: string,
): Promise<T[]> {
  const url = new URL(path, connectorBaseUrl());
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`connector ${path} responded ${res.status}`);
  const data = (await res.json()) as Record<string, T[]>;
  return data[key] ?? [];
}

async function getRiskScores(
  params: Record<string, unknown>,
): Promise<ToolResult> {
  const riskLevel = asRisk(params.riskLevel);
  const limit = clampLimit(params.limit);
  const resolvedParams = { riskLevel, limit };

  const rows = await fetchConnector<RiskRow>(
    "/api/risk-score",
    { riskLevel, limit: String(limit) },
    "scores",
  );

  return {
    resolvedParams,
    source: "risk-service",
    columns: [
      { key: "customer", label: "Customer", classification: "PUBLIC" },
      { key: "score", label: "Risk Score", classification: "PUBLIC" },
      { key: "band", label: "Band", classification: "PUBLIC" },
      { key: "model", label: "Model", classification: "PUBLIC" },
    ],
    rows: rows.map((r) => ({ id: r.customerId, ...r })),
  };
}

async function getLoginActivity(
  params: Record<string, unknown>,
): Promise<ToolResult> {
  const riskLevel = asRisk(params.riskLevel);
  const limit = clampLimit(params.limit);
  const resolvedParams = { riskLevel, limit };

  const rows = await fetchConnector<ActivityRow>(
    "/api/connectors/redshift",
    { riskLevel, limit: String(limit) },
    "rows",
  );

  return {
    resolvedParams,
    source: "redshift",
    columns: [
      { key: "customer", label: "Customer", classification: "PUBLIC" },
      { key: "lastSeen", label: "Last Seen", classification: "PUBLIC" },
      { key: "sessions30d", label: "Sessions (30d)", classification: "PUBLIC" },
      { key: "ipAddress", label: "Last IP", classification: "PII" },
      { key: "country", label: "Country", classification: "PUBLIC" },
    ],
    rows: rows.map((r) => ({ id: r.customerId, ...r })),
  };
}

async function getSpendAnalytics(
  params: Record<string, unknown>,
): Promise<ToolResult> {
  const riskLevel = asRisk(params.riskLevel);
  const limit = clampLimit(params.limit);
  const resolvedParams = { riskLevel, limit };

  const rows = await fetchConnector<SpendRow>(
    "/api/connectors/bigquery",
    { riskLevel, limit: String(limit) },
    "rows",
  );

  return {
    resolvedParams,
    source: "bigquery",
    columns: [
      { key: "customer", label: "Customer", classification: "PUBLIC" },
      {
        key: "lifetimeSpend",
        label: "Lifetime Spend",
        classification: "FINANCIAL",
      },
      { key: "topCategory", label: "Top Category", classification: "PUBLIC" },
      { key: "ltvBand", label: "LTV Band", classification: "PUBLIC" },
    ],
    rows: rows.map((r) => ({ id: r.customerId, ...r })),
  };
}

// Composite tool: fans out across every connector and joins on customer id.
// This is the multi-source "one tool over many places" capability.
async function getCustomer360(
  params: Record<string, unknown>,
): Promise<ToolResult> {
  const riskLevel = asRisk(params.riskLevel);
  const search = asString(params.search);
  const limit = clampLimit(params.limit);
  const resolvedParams = { riskLevel, search, limit, sources: 4 };

  const customers = await prisma.customer.findMany({
    where: {
      ...(riskLevel ? { riskLevel } : {}),
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

  const [risk, activity, spend] = await Promise.all([
    fetchConnector<RiskRow>("/api/risk-score", { limit: "100" }, "scores"),
    fetchConnector<ActivityRow>(
      "/api/connectors/redshift",
      { limit: "100" },
      "rows",
    ),
    fetchConnector<SpendRow>(
      "/api/connectors/bigquery",
      { limit: "100" },
      "rows",
    ),
  ]);

  const riskById = new Map(risk.map((r) => [r.customerId, r]));
  const activityById = new Map(activity.map((r) => [r.customerId, r]));
  const spendById = new Map(spend.map((r) => [r.customerId, r]));

  return {
    resolvedParams,
    source: "postgres + risk-service + redshift + bigquery",
    columns: [
      { key: "name", label: "Customer", classification: "PUBLIC" },
      { key: "email", label: "Email", classification: "PII" },
      { key: "ssn", label: "SSN", classification: "SENSITIVE" },
      { key: "riskLevel", label: "Risk", classification: "PUBLIC" },
      { key: "score", label: "Model Score", classification: "PUBLIC" },
      { key: "sessions30d", label: "Sessions", classification: "PUBLIC" },
      { key: "ipAddress", label: "Last IP", classification: "PII" },
      {
        key: "lifetimeSpend",
        label: "Lifetime Spend",
        classification: "FINANCIAL",
      },
    ],
    rows: customers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      ssn: c.ssn,
      riskLevel: c.riskLevel,
      score: riskById.get(c.id)?.score ?? null,
      sessions30d: activityById.get(c.id)?.sessions30d ?? null,
      ipAddress: activityById.get(c.id)?.ipAddress ?? null,
      lifetimeSpend: spendById.get(c.id)?.lifetimeSpend ?? null,
    })),
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
  getLoginActivity,
  getSpendAnalytics,
  getCustomer360,
};

export function runTool(
  tool: ToolName,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  return TOOL_IMPL[tool](params);
}
