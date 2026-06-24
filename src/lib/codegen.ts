import type { Role, ToolSpec, ComposedComponent } from "./types";

// ---------------------------------------------------------------------------
// Deterministic spec -> code serializer ("eject to code").
//
// The generator never emits free-form code; it serializes the already-composed,
// already-governed ToolSpec into (1) the spec JSON and (2) a self-contained
// React/TypeScript component that an engineer can paste into a codebase to take
// over the prototype. The emitted code calls the SAME governed API endpoints,
// so server-side role checks and field masking still apply at runtime — the
// generated code cannot escape governance.
// ---------------------------------------------------------------------------

export interface GeneratedFile {
  filename: string;
  language: "tsx" | "json";
  contents: string;
}

function pascal(input: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9 ]/g, " ");
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const joined = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
  const name = joined || "GeneratedTool";
  return /^[0-9]/.test(name) ? "Tool" + name : name;
}

function kebab(input: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  return cleaned.replace(/^-+|-+$/g, "") || "generated-tool";
}

function sectionName(component: ComposedComponent, index: number): string {
  return component.component + "Section" + (index + 1);
}

// Build the React function body for a single composed component.
function emitSection(
  spec: ToolSpec,
  component: ComposedComponent,
  index: number,
): string {
  const name = sectionName(component, index);
  const actions = spec.actions.filter(
    (a) => a.appliesTo === component.component,
  );
  const paramsLiteral = JSON.stringify(component.params);
  const lines: string[] = [];

  lines.push("function " + name + "() {");
  lines.push("  const [data, setData] = useState<ToolResult | null>(null);");
  lines.push("  const [error, setError] = useState<string | null>(null);");
  lines.push("");
  lines.push("  const load = useCallback(() => {");
  lines.push(
    '    runTool("' + component.tool + '", ' + paramsLiteral + ")",
  );
  lines.push("      .then(setData)");
  lines.push("      .catch((e) => setError(String(e.message)));");
  lines.push("  }, []);");
  lines.push("");
  lines.push("  useEffect(() => { load(); }, [load]);");
  lines.push("");

  if (actions.length > 0) {
    const action = actions[0];
    lines.push("  async function handleAction(row: Row) {");
    lines.push(
      '    if (!confirm("' + action.label + ' — this writes back. Continue?")) return;',
    );
    lines.push("    const params: Record<string, unknown> = { id: row.id };");
    if (action.action === "addCustomerNote") {
      lines.push('    const note = prompt("Review note");');
      lines.push("    if (note === null) return;");
      lines.push("    params.note = note;");
    }
    lines.push("    try {");
    lines.push(
      '      await runAction("' + action.action + '", params); // authorized server-side; admin only',
    );
    lines.push("      load();");
    lines.push("    } catch (e) {");
    lines.push("      alert(String((e as Error).message));");
    lines.push("    }");
    lines.push("  }");
    lines.push("");
  }

  lines.push('  if (error) return <p className="error">{error}</p>;');
  lines.push("  if (!data) return <p>Loading…</p>;");
  lines.push("");
  lines.push("  return (");
  lines.push('    <section className="tool-section">');
  lines.push("      <h2>" + component.title + "</h2>");
  lines.push(
    "      <p className=\"source\">source: {data.source}</p>",
  );
  lines.push("      {data.masking?.some((m) => m.action === \"masked\") && (");
  lines.push('        <p className="governed">');
  lines.push(
    '          🔒 Masked for your role: {data.masking.filter((m) => m.action === "masked").map((m) => m.field).join(", ")}',
  );
  lines.push("        </p>");
  lines.push("      )}");
  lines.push("      <table>");
  lines.push("        <thead>");
  lines.push("          <tr>");
  lines.push(
    "            {data.columns.map((c) => (",
  );
  lines.push(
    "              <th key={c.key}>{c.label}{c.classification !== \"PUBLIC\" ? \" (\" + c.classification + \")\" : \"\"}</th>",
  );
  lines.push("            ))}");
  if (actions.length > 0) lines.push("            <th />");
  lines.push("          </tr>");
  lines.push("        </thead>");
  lines.push("        <tbody>");
  lines.push("          {data.rows.map((row, i) => (");
  lines.push("            <tr key={i}>");
  lines.push(
    "              {data.columns.map((c) => (",
  );
  lines.push(
    "                <td key={c.key}>{String(row[c.key] ?? \"\")}</td>",
  );
  lines.push("              ))}");
  if (actions.length > 0) {
    lines.push("              <td>");
    lines.push(
      '                <button onClick={() => handleAction(row)}>' +
        actions[0].label +
        "</button>",
    );
    lines.push("              </td>");
  }
  lines.push("            </tr>");
  lines.push("          ))}");
  lines.push("        </tbody>");
  lines.push("      </table>");
  lines.push("    </section>");
  lines.push("  );");
  lines.push("}");
  return lines.join("\n");
}

function emitComponentFile(spec: ToolSpec, role: Role): GeneratedFile {
  const compName = pascal(spec.title);
  const hasActions = spec.actions.length > 0;
  const lines: string[] = [];

  lines.push('"use client";');
  lines.push("");
  lines.push('import { useCallback, useEffect, useState } from "react";');
  lines.push("");
  lines.push("// Auto-generated from prompt: " + JSON.stringify(spec.summary));
  lines.push("// Composed for role: " + role + ".");
  lines.push(
    "// Governance note: this component calls the same governed endpoints as the",
  );
  lines.push(
    "// generator. Field masking and write authorization are enforced SERVER-SIDE",
  );
  lines.push(
    "// (/api/tools/execute, /api/actions/execute) — the code below cannot bypass them.",
  );
  if (!hasActions) {
    lines.push(
      "// No write actions were composed for this role (read-only).",
    );
  }
  lines.push("");
  lines.push("type Row = Record<string, unknown>;");
  lines.push("type Column = { key: string; label: string; classification: string };");
  lines.push("type Masking = { field: string; classification: string; action: string };");
  lines.push(
    "type ToolResult = { columns: Column[]; rows: Row[]; source: string; masking?: Masking[] };",
  );
  lines.push("");
  lines.push(
    "async function runTool(tool: string, params: Record<string, unknown>): Promise<ToolResult> {",
  );
  lines.push('  const res = await fetch("/api/tools/execute", {');
  lines.push('    method: "POST",');
  lines.push('    headers: { "Content-Type": "application/json" },');
  lines.push("    body: JSON.stringify({ tool, params }),");
  lines.push("  });");
  lines.push("  const json = await res.json();");
  lines.push("  if (!res.ok) throw new Error(json.error);");
  lines.push("  return json as ToolResult;");
  lines.push("}");
  lines.push("");
  if (hasActions) {
    lines.push(
      "async function runAction(action: string, params: Record<string, unknown>) {",
    );
    lines.push('  const res = await fetch("/api/actions/execute", {');
    lines.push('    method: "POST",');
    lines.push('    headers: { "Content-Type": "application/json" },');
    lines.push("    body: JSON.stringify({ action, params }),");
    lines.push("  });");
    lines.push("  const json = await res.json();");
    lines.push("  if (!res.ok) throw new Error(json.error);");
    lines.push("  return json;");
    lines.push("}");
    lines.push("");
  }

  spec.components.forEach((component, index) => {
    lines.push(emitSection(spec, component, index));
    lines.push("");
  });

  lines.push("export default function " + compName + "() {");
  lines.push("  return (");
  lines.push('    <div className="generated-tool">');
  lines.push("      <header>");
  lines.push("        <h1>" + spec.title + "</h1>");
  lines.push("        <p>" + spec.summary + "</p>");
  lines.push("      </header>");
  spec.components.forEach((component, index) => {
    lines.push("      <" + sectionName(component, index) + " />");
  });
  lines.push("    </div>");
  lines.push("  );");
  lines.push("}");
  lines.push("");

  return {
    filename: pascal(spec.title) + ".tsx",
    language: "tsx",
    contents: lines.join("\n"),
  };
}

export function generateToolCode(spec: ToolSpec, role: Role): GeneratedFile[] {
  const specFile: GeneratedFile = {
    filename: kebab(spec.title) + ".spec.json",
    language: "json",
    contents: JSON.stringify(spec, null, 2),
  };
  return [emitComponentFile(spec, role), specFile];
}
