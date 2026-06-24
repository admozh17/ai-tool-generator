import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { TOOLS, roleSatisfies } from "@/lib/registry";
import { runTool } from "@/lib/tools";
import { applyMasking, maskedFields } from "@/lib/governance";
import { writeAudit } from "@/lib/audit";
import type { ToolName } from "@/lib/types";

export async function POST(request: NextRequest) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    tool?: string;
    params?: Record<string, unknown>;
  };
  const toolName = body.tool as ToolName;
  const params = body.params ?? {};

  const def = TOOLS[toolName];
  if (!def) {
    return NextResponse.json(
      { error: `Unknown tool "${body.tool}".` },
      { status: 400 },
    );
  }

  // Server-side authorization: the registry, not the prompt, decides access.
  if (!roleSatisfies(user.role, def.minRole)) {
    await writeAudit({
      user,
      kind: "data_fetch",
      name: toolName,
      params,
      outcome: "denied",
    });
    return NextResponse.json(
      { error: `Role "${user.role}" may not run "${toolName}".` },
      { status: 403 },
    );
  }

  try {
    const result = await runTool(toolName, params);
    // Governance: mask classified fields server-side, per role, BEFORE the
    // response leaves the server. The masked values never exist client-side.
    const masked = applyMasking(result.columns, result.rows, user.role);
    const redacted = maskedFields(masked.masking);
    await writeAudit({
      user,
      kind: "data_fetch",
      name: toolName,
      params: {
        ...result.resolvedParams,
        ...(redacted.length ? { maskedFields: redacted } : {}),
      },
    });
    return NextResponse.json({
      columns: masked.columns,
      rows: masked.rows,
      masking: masked.masking,
      source: result.source,
    });
  } catch (err) {
    await writeAudit({
      user,
      kind: "data_fetch",
      name: toolName,
      params,
      outcome: "error",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tool failed." },
      { status: 500 },
    );
  }
}
