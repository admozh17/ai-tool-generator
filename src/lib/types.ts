export type Role = "viewer" | "admin";

export type ComponentType =
  | "CustomerTable"
  | "AccountCards"
  | "TransactionTable"
  | "RiskScorePanel";

export type ToolName =
  | "listCustomers"
  | "listAccounts"
  | "listTransactions"
  | "getRiskScores";

export type ActionName = "freezeAccount" | "flagTransaction" | "addCustomerNote";

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
