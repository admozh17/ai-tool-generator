import type { ConnectorId, DataClass, ToolName } from "./types";

// ---------------------------------------------------------------------------
// Connector registry. Each connector is a governed data source the generator
// can build tools over. Postgres and the risk microservice are real; Redshift
// and BigQuery are realistic mocks BEHIND THE SAME INTERFACE — swapping either
// to a real warehouse is a connector-config change, not an app rewrite.
//
// Every field is classified so the governance layer can mask it per role.
// ---------------------------------------------------------------------------

export type ConnectorKind =
  | "Postgres (primary database)"
  | "REST microservice"
  | "Redshift (warehouse, mocked)"
  | "BigQuery (warehouse, mocked)";

export interface ConnectorField {
  key: string;
  label: string;
  classification: DataClass;
}

export interface ConnectorDef {
  id: ConnectorId;
  label: string;
  kind: ConnectorKind;
  real: boolean;
  description: string;
  fields: ConnectorField[];
  tools: ToolName[];
}

export const CONNECTORS: Record<ConnectorId, ConnectorDef> = {
  postgres: {
    id: "postgres",
    label: "Core Banking DB",
    kind: "Postgres (primary database)",
    real: true,
    description:
      "Primary source of record: customers, accounts and transactions. Includes sensitive ingested columns (SSN).",
    fields: [
      { key: "name", label: "Customer", classification: "PUBLIC" },
      { key: "email", label: "Email", classification: "PII" },
      { key: "ssn", label: "SSN", classification: "SENSITIVE" },
      { key: "riskLevel", label: "Risk level", classification: "PUBLIC" },
      { key: "balance", label: "Balance", classification: "FINANCIAL" },
      { key: "amount", label: "Txn amount", classification: "FINANCIAL" },
      { key: "status", label: "Status", classification: "PUBLIC" },
    ],
    tools: ["listCustomers", "listAccounts", "listTransactions"],
  },
  "risk-service": {
    id: "risk-service",
    label: "Risk Scoring Service",
    kind: "REST microservice",
    real: true,
    description:
      "External model-scoring microservice. Returns model risk scores rather than raw rows — data from a second place.",
    fields: [
      { key: "score", label: "Risk score", classification: "PUBLIC" },
      { key: "band", label: "Band", classification: "PUBLIC" },
      { key: "model", label: "Model", classification: "PUBLIC" },
    ],
    tools: ["getRiskScores"],
  },
  redshift: {
    id: "redshift",
    label: "Events Warehouse",
    kind: "Redshift (warehouse, mocked)",
    real: false,
    description:
      "Login/activity warehouse. Mocked behind the connector interface; returns per-customer session telemetry.",
    fields: [
      { key: "lastSeen", label: "Last seen", classification: "PUBLIC" },
      { key: "sessions30d", label: "Sessions (30d)", classification: "PUBLIC" },
      { key: "ipAddress", label: "Last IP", classification: "PII" },
      { key: "country", label: "Country", classification: "PUBLIC" },
    ],
    tools: ["getLoginActivity"],
  },
  bigquery: {
    id: "bigquery",
    label: "Marketing Analytics",
    kind: "BigQuery (warehouse, mocked)",
    real: false,
    description:
      "Spend/marketing analytics warehouse. Mocked behind the connector interface; returns per-customer lifetime value.",
    fields: [
      {
        key: "lifetimeSpend",
        label: "Lifetime spend",
        classification: "FINANCIAL",
      },
      { key: "topCategory", label: "Top category", classification: "PUBLIC" },
      { key: "ltvBand", label: "LTV band", classification: "PUBLIC" },
    ],
    tools: ["getSpendAnalytics"],
  },
};

export const CONNECTOR_LIST: ConnectorDef[] = Object.values(CONNECTORS);

// Base URL the app uses to reach its own mocked connector endpoints.
export function connectorBaseUrl(): string {
  return process.env.RISK_SERVICE_BASE_URL || "http://localhost:3000";
}
