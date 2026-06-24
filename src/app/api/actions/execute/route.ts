import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { ACTIONS, roleSatisfies } from "@/lib/registry";
import { runAction } from "@/lib/actions";
import { writeAudit } from "@/lib/audit";
import type { ActionName } from "@/lib/types";

export async function POST(request: NextRequest) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    params?: Record<string, unknown>;
  };
  const actionName = body.action as ActionName;
  const params = body.params ?? {};

  const def = ACTIONS[actionName];
  if (!def) {
    return NextResponse.json(
      { error: `Unknown action "${body.action}".` },
      { status: 400 },
    );
  }

  // Hard governance boundary: a viewer is physically unable to execute a write,
  // no matter how the generated tool or prompt was phrased.
  if (!roleSatisfies(user.role, def.minRole)) {
    await writeAudit({
      user,
      kind: "action",
      name: actionName,
      params,
      targetType: def.targetType,
      targetId: typeof params.id === "string" ? params.id : undefined,
      outcome: "denied",
    });
    return NextResponse.json(
      { error: `Role "${user.role}" may not perform "${actionName}".` },
      { status: 403 },
    );
  }

  try {
    const result = await runAction(actionName, params);
    await writeAudit({
      user,
      kind: "action",
      name: actionName,
      params: result.resolvedParams,
      targetType: result.targetType,
      targetId: result.targetId,
    });
    return NextResponse.json({ message: result.message });
  } catch (err) {
    await writeAudit({
      user,
      kind: "action",
      name: actionName,
      params,
      targetType: def.targetType,
      targetId: typeof params.id === "string" ? params.id : undefined,
      outcome: "error",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed." },
      { status: 500 },
    );
  }
}
