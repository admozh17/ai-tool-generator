export type Role = "viewer" | "admin";

// Data classification for every column a connector exposes. Governs masking.
export type DataClass = "PUBLIC" | "PII" | "FINANCIAL" | "SENSITIVE";

export type ComponentType =
  | "CustomerTable"
  | "AccountCards"
  | "TransactionTable"
  | "RiskScorePanel"
  | "LoginActivityTable"
  | "SpendAnalyticsTable"
  | "Customer360Table";

export type ToolName =
  | "listCustomers"
  | "listAccounts"
  | "listTransactions"
  | "getRiskScores"
  | "getLoginActivity"
  | "getSpendAnalytics"
  | "getCustomer360";

export type ConnectorId =
  | "postgres"
  | "risk-service"
  | "redshift"
  | "bigquery";

export type ActionName = "freezeAccount" | "flagTransaction" | "addCustomerNote";

// A column a connector/tool exposes, carrying its data classification so the
// governance layer can decide visibility per role.
export interface ResultColumn {
  key: string;
  label: string;
  classification: DataClass;
  // Set by the governance layer: true when values were masked for the caller.
  masked?: boolean;
}

// One entry per classified column, recording whether it was shown or masked.
export interface MaskingEntry {
  field: string;
  classification: DataClass;
  action: "visible" | "masked";
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

// A single rendered component within a composed tool.
export interface ComposedComponent {
  id: string;
  component: ComponentType;
  tool: ToolName;
  title: string;
  params: Record<string, unknown>;
}

// A write action attached to the composed tool.
export interface ComposedAction {
  action: ActionName;
  label: string;
  appliesTo: ComponentType;
  requiresConfirmation: boolean;
}

// The JSON spec the generator returns and the frontend renders. This is the
// ONLY thing the model is allowed to produce — never code or SQL.
export interface ToolSpec {
  title: string;
  summary: string;
  components: ComposedComponent[];
  actions: ComposedAction[];
  // Human-readable governance notes, e.g. why write actions were stripped.
  notes: string[];
}

export interface GenerateResponse {
  spec: ToolSpec;
  source: "llm" | "rule-based";
}
