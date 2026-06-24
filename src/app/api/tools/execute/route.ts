import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { TOOLS, roleSatisfies } from "@/lib/registry";
import { runTool } from "@/lib/tools";
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
    await writeAudit({
      user,
      kind: "data_fetch",
      name: toolName,
      params: result.resolvedParams,
    });
    return NextResponse.json({
      columns: result.columns,
      rows: result.rows,
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
