import type {
  ActionName,
  ComponentType,
  Role,
  ToolName,
} from "./types";

// ---------------------------------------------------------------------------
// The governed registry. The LLM may ONLY compose tools from these entries.
// No free-form code, no free-form SQL. Every read tool and write action is
// authorized server-side against the caller's role before it runs.
// ---------------------------------------------------------------------------

export interface ToolDef {
  name: ToolName;
  description: string;
  source: "postgres" | "risk-service";
  // The smallest role allowed to execute this read tool.
  minRole: Role;
}

export interface ComponentDef {
  type: ComponentType;
  description: string;
  tool: ToolName;
}

export interface ActionDef {
  name: ActionName;
  description: string;
  targetType: "Account" | "Transaction" | "Customer";
  // Write actions require admin and an explicit confirmation step.
  minRole: Role;
  requiresConfirmation: boolean;
}

export const TOOLS: Record<ToolName, ToolDef> = {
  listCustomers: {
    name: "listCustomers",
    description:
      "List customers with optional riskLevel (low|medium|high) and text search.",
    source: "postgres",
    minRole: "viewer",
  },
  listAccounts: {
    name: "listAccounts",
    description:
      "List accounts with optional status (active|frozen) filter and balance.",
    source: "postgres",
    minRole: "viewer",
  },
  listTransactions: {
    name: "listTransactions",
    description:
      "List transactions with optional status (normal|flagged) and minAmount.",
    source: "postgres",
    minRole: "viewer",
  },
  getRiskScores: {
    name: "getRiskScores",
    description:
      "Fetch model risk scores from the external risk-scoring microservice (second data source).",
    source: "risk-service",
    minRole: "viewer",
  },
};

export const COMPONENTS: Record<ComponentType, ComponentDef> = {
  CustomerTable: {
    type: "CustomerTable",
    description:
      "A sortable table of customers showing risk level and account status.",
    tool: "listCustomers",
  },
  AccountCards: {
    type: "AccountCards",
    description: "Cards showing each account's type, balance and status.",
    tool: "listAccounts",
  },
  TransactionTable: {
    type: "TransactionTable",
    description: "A table of transactions, highlighting flagged ones.",
    tool: "listTransactions",
  },
  RiskScorePanel: {
    type: "RiskScorePanel",
    description:
      "A panel of model risk scores sourced from the external risk service.",
    tool: "getRiskScores",
  },
};

export const ACTIONS: Record<ActionName, ActionDef> = {
  freezeAccount: {
    name: "freezeAccount",
    description: "Freeze an account so no further transactions can post.",
    targetType: "Account",
    minRole: "admin",
    requiresConfirmation: true,
  },
  flagTransaction: {
    name: "flagTransaction",
    description: "Flag a transaction as suspicious for review.",
    targetType: "Transaction",
    minRole: "admin",
    requiresConfirmation: true,
  },
  addCustomerNote: {
    name: "addCustomerNote",
    description: "Attach a review note to a customer record.",
    targetType: "Customer",
    minRole: "admin",
    requiresConfirmation: true,
  },
};

const ROLE_RANK: Record<Role, number> = { viewer: 0, admin: 1 };

export function roleSatisfies(userRole: Role, minRole: Role): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole];
}

// Which write actions naturally apply to a given component (by target entity).
export function actionsForComponent(component: ComponentType): ActionName[] {
  switch (component) {
    case "AccountCards":
      return ["freezeAccount"];
    case "TransactionTable":
      return ["flagTransaction"];
    case "CustomerTable":
      return ["addCustomerNote"];
    default:
      return [];
  }
}

export function isComponent(value: string): value is ComponentType {
  return value in COMPONENTS;
}

export function isAction(value: string): value is ActionName {
  return value in ACTIONS;
}
