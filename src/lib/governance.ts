import type {
  DataClass,
  MaskingEntry,
  ResultColumn,
  Role,
} from "./types";

// ---------------------------------------------------------------------------
// Data governance: field-level masking by classification, enforced SERVER-SIDE
// at the API layer. The LLM never sees raw classified values and never decides
// visibility — this table does, keyed only by the caller's role.
//
//   PUBLIC     always visible
//   PII        visible to admin, masked for viewer
//   FINANCIAL  visible to admin, masked for viewer
//   SENSITIVE  masked for EVERYONE — no raw SSN ever leaves through a tool,
//              regardless of role or prompt wording.
// ---------------------------------------------------------------------------

type Visibility = "visible" | "masked";

const POLICY: Record<Role, Record<DataClass, Visibility>> = {
  admin: {
    PUBLIC: "visible",
    PII: "visible",
    FINANCIAL: "visible",
    SENSITIVE: "masked",
  },
  viewer: {
    PUBLIC: "visible",
    PII: "masked",
    FINANCIAL: "masked",
    SENSITIVE: "masked",
  },
};

export function visibilityFor(role: Role, cls: DataClass): Visibility {
  return POLICY[role][cls];
}

const DOT = "\u2022";

function maskValue(value: unknown, cls: DataClass): string {
  if (value === null || value === undefined || value === "") return "—";
  const s = String(value);
  switch (cls) {
    case "PII": {
      if (s.includes("@")) {
        const [local, domain] = s.split("@");
        return `${local.slice(0, 1)}${DOT.repeat(3)}@${domain}`;
      }
      return DOT.repeat(Math.min(8, Math.max(4, s.length)));
    }
    case "FINANCIAL":
      return typeof value === "number" ? `$${DOT.repeat(4)}` : DOT.repeat(4);
    case "SENSITIVE": {
      const last4 = s.replace(/\D/g, "").slice(-4) || s.slice(-4);
      return `${DOT.repeat(3)}-${DOT.repeat(2)}-${last4}`;
    }
    default:
      return s;
  }
}

export interface MaskedResult {
  columns: ResultColumn[];
  rows: Record<string, unknown>[];
  masking: MaskingEntry[];
}

// Apply the policy to a tool result for a given role. Returns new columns (with
// a `masked` flag), masked rows, and a summary of what was shown vs masked.
export function applyMasking(
  columns: ResultColumn[],
  rows: Record<string, unknown>[],
  role: Role,
): MaskedResult {
  const masking: MaskingEntry[] = [];
  const maskedKeys: { key: string; cls: DataClass }[] = [];

  const outColumns = columns.map((c) => {
    if (c.classification !== "PUBLIC") {
      const action = visibilityFor(role, c.classification);
      masking.push({ field: c.key, classification: c.classification, action });
      if (action === "masked") {
        maskedKeys.push({ key: c.key, cls: c.classification });
        return { ...c, masked: true };
      }
    }
    return { ...c, masked: false };
  });

  const outRows =
    maskedKeys.length === 0
      ? rows
      : rows.map((row) => {
          const next = { ...row };
          for (const { key, cls } of maskedKeys) {
            next[key] = maskValue(row[key], cls);
          }
          return next;
        });

  return { columns: outColumns, rows: outRows, masking };
}

// The list of fields actually masked, for the audit trail.
export function maskedFields(masking: MaskingEntry[]): string[] {
  return masking.filter((m) => m.action === "masked").map((m) => m.field);
}
