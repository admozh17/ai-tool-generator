import {
  ACTIONS,
  COMPONENTS,
  actionsForComponent,
  isAction,
  isComponent,
  roleSatisfies,
} from "./registry";
import type {
  ActionName,
  ComponentType,
  ComposedAction,
  ComposedComponent,
  GenerateResponse,
  Role,
  ToolSpec,
} from "./types";

// What a composer (LLM or rule-based) proposes before governance is applied.
interface Selection {
  title: string;
  summary: string;
  components: ComponentType[];
  actions: ActionName[];
  filters: {
    riskLevel?: "low" | "medium" | "high";
    status?: string;
    minAmount?: number;
    search?: string;
  };
}

const COMPONENT_FOR_ACTION: Record<ActionName, ComponentType> = {
  freezeAccount: "AccountCards",
  flagTransaction: "TransactionTable",
  addCustomerNote: "CustomerTable",
};

// ---------------------------------------------------------------------------
// Governance: turn a raw Selection into a validated, role-aware ToolSpec.
// Anything outside the registry is dropped. Write actions are removed entirely
// for viewers — a viewer's tool is physically incapable of carrying a write.
// ---------------------------------------------------------------------------
function buildSpec(selection: Selection, role: Role): ToolSpec {
  const notes: string[] = [];
  const componentSet = new Set<ComponentType>();

  for (const c of selection.components) {
    if (isComponent(c)) componentSet.add(c);
  }

  const keptActions: ActionName[] = [];
  for (const a of selection.actions) {
    if (!isAction(a)) continue;
    const def = ACTIONS[a];
    if (!roleSatisfies(role, def.minRole)) {
      notes.push(
        `Removed "${a}" — requires ${def.minRole} role (caller is ${role}).`,
      );
      continue;
    }
    keptActions.push(a);
    // Ensure the component the action operates on is present so it can render.
    componentSet.add(COMPONENT_FOR_ACTION[a]);
  }

  if (componentSet.size === 0) componentSet.add("CustomerTable");

  const components: ComposedComponent[] = [...componentSet].map((type, i) => {
    const def = COMPONENTS[type];
    const params: Record<string, unknown> = {};
    if (type === "CustomerTable" || type === "RiskScorePanel") {
      if (selection.filters.riskLevel)
        params.riskLevel = selection.filters.riskLevel;
      if (selection.filters.search) params.search = selection.filters.search;
    }
    if (type === "AccountCards" && selection.filters.status) {
      params.status = selection.filters.status;
    }
    if (type === "TransactionTable") {
      if (selection.filters.status) params.status = selection.filters.status;
      if (selection.filters.minAmount !== undefined)
        params.minAmount = selection.filters.minAmount;
    }
    return {
      id: `${type}-${i}`,
      component: type,
      tool: def.tool,
      title: titleForComponent(type),
      params,
    };
  });

  const actions: ComposedAction[] = keptActions
    .filter((a) => actionsForComponent(COMPONENT_FOR_ACTION[a]).includes(a))
    .map((a) => ({
      action: a,
      label: labelForAction(a),
      appliesTo: COMPONENT_FOR_ACTION[a],
      requiresConfirmation: ACTIONS[a].requiresConfirmation,
    }));

  if (role === "viewer") {
    notes.push(
      "Viewer role: this tool is read-only. The server rejects any write action regardless of prompt wording.",
    );
  }

  return {
    title: selection.title || "Generated Tool",
    summary: selection.summary || "A composed tool over governed building blocks.",
    components,
    actions,
    notes,
  };
}

function titleForComponent(type: ComponentType): string {
  switch (type) {
    case "CustomerTable":
      return "Customers";
    case "AccountCards":
      return "Accounts";
    case "TransactionTable":
      return "Transactions";
    case "RiskScorePanel":
      return "Risk Scores (external service)";
  }
}

function labelForAction(a: ActionName): string {
  switch (a) {
    case "freezeAccount":
      return "Freeze account";
    case "flagTransaction":
      return "Flag transaction";
    case "addCustomerNote":
      return "Add review note";
  }
}

// ---------------------------------------------------------------------------
// Deterministic, keyword-based composer. Used when no LLM key is configured or
// when the LLM call fails. Always produces a valid Selection.
// ---------------------------------------------------------------------------
export function ruleBasedCompose(prompt: string): Selection {
  const p = prompt.toLowerCase();
  const components = new Set<ComponentType>();
  const actions = new Set<ActionName>();
  const filters: Selection["filters"] = {};

  if (/high[ -]?risk|risky/.test(p)) filters.riskLevel = "high";
  else if (/medium[ -]?risk/.test(p)) filters.riskLevel = "medium";
  else if (/low[ -]?risk/.test(p)) filters.riskLevel = "low";

  if (/transaction|payment|charge/.test(p)) components.add("TransactionTable");
  if (/account/.test(p)) components.add("AccountCards");
  if (/customer|client|user/.test(p)) components.add("CustomerTable");
  if (/risk score|score|model|fraud model/.test(p))
    components.add("RiskScorePanel");

  if (/freeze|frozen|block account|suspend/.test(p))
    actions.add("freezeAccount");
  if (/flag|suspicious|review transaction/.test(p))
    actions.add("flagTransaction");
  if (/note|annotate|comment/.test(p)) actions.add("addCustomerNote");

  if (/frozen/.test(p)) filters.status = "frozen";
  if (/flagged/.test(p) && components.has("TransactionTable"))
    filters.status = "flagged";

  const amountMatch = p.match(/(?:over|above|more than|>\s*)\$?\s*([\d,]+)/);
  if (amountMatch) {
    const n = Number(amountMatch[1].replace(/,/g, ""));
    if (Number.isFinite(n)) {
      filters.minAmount = n;
      components.add("TransactionTable");
    }
  }

  if (components.size === 0) components.add("CustomerTable");

  return {
    title: deriveTitle(prompt),
    summary: `Composed from your request: "${prompt.trim().slice(0, 140)}"`,
    components: [...components],
    actions: [...actions],
    filters,
  };
}

function deriveTitle(prompt: string): string {
  const t = prompt.trim().replace(/\s+/g, " ");
  if (!t) return "Generated Tool";
  return t.charAt(0).toUpperCase() + t.slice(1, 60);
}

// ---------------------------------------------------------------------------
// LLM composer (OpenAI). Constrained via a JSON tool schema whose enums are the
// registry itself, so the model can only ever return registry members.
// ---------------------------------------------------------------------------
async function llmCompose(prompt: string): Promise<Selection> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("no api key");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const tool = {
    type: "function",
    function: {
      name: "compose_tool",
      description:
        "Compose an internal tool from the fixed registry. You may ONLY use the listed components and actions. Never write code or SQL.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          components: {
            type: "array",
            items: { type: "string", enum: Object.keys(COMPONENTS) },
          },
          actions: {
            type: "array",
            items: { type: "string", enum: Object.keys(ACTIONS) },
          },
          filters: {
            type: "object",
            properties: {
              riskLevel: { type: "string", enum: ["low", "medium", "high"] },
              status: { type: "string" },
              minAmount: { type: "number" },
              search: { type: "string" },
            },
          },
        },
        required: ["title", "summary", "components"],
      },
    },
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You translate a plain-English request for an internal tool into a composition over a fixed registry of components and actions. Pick the smallest set that satisfies the request. Call the compose_tool function.",
        },
        { role: "user", content: prompt },
      ],
      tools: [tool],
      tool_choice: {
        type: "function",
        function: { name: "compose_tool" },
      },
    }),
  });

  if (!res.ok) throw new Error(`openai responded ${res.status}`);
  const data = await res.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("no tool call returned");
  const args = JSON.parse(call.function.arguments) as Partial<Selection>;

  return {
    title: args.title || deriveTitle(prompt),
    summary: args.summary || "",
    components: (args.components ?? []).filter(isComponent),
    actions: (args.actions ?? []).filter(isAction),
    filters: args.filters ?? {},
  };
}

// Main entry point. Returns the governed spec plus which composer produced it.
export async function generateSpec(
  prompt: string,
  role: Role,
): Promise<GenerateResponse> {
  if (process.env.OPENAI_API_KEY) {
    try {
      const selection = await llmCompose(prompt);
      return { spec: buildSpec(selection, role), source: "llm" };
    } catch {
      // Fall through to deterministic composer on any LLM failure.
    }
  }
  const selection = ruleBasedCompose(prompt);
  return { spec: buildSpec(selection, role), source: "rule-based" };
}
