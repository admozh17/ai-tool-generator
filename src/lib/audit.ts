import { prisma } from "./prisma";
import type { AuthUser } from "./types";

interface AuditInput {
  user: AuthUser;
  kind: "data_fetch" | "action" | "generation";
  name: string;
  params: Record<string, unknown>;
  targetType?: string;
  targetId?: string;
  outcome?: "success" | "denied" | "error";
}

// Writes one append-only audit row. Records the resolved registry tool/action
// and its parameters (not just the prose prompt), the target record, the actor,
// and the outcome. There is no update/delete path for audit rows in the app.
export async function writeAudit(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.user.id,
      userEmail: input.user.email,
      role: input.user.role,
      kind: input.kind,
      name: input.name,
      params: input.params as object,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      outcome: input.outcome ?? "success",
    },
  });
}
