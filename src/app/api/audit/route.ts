import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Admins see the full append-only log; viewers see only their own activity.
  const logs = await prisma.auditLog.findMany({
    where: user.role === "admin" ? {} : { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      userEmail: l.userEmail,
      role: l.role,
      kind: l.kind,
      name: l.name,
      params: l.params,
      targetType: l.targetType,
      targetId: l.targetId,
      outcome: l.outcome,
      createdAt: l.createdAt,
    })),
    scope: user.role === "admin" ? "all" : "self",
  });
}
