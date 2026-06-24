import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Mocked Redshift "events warehouse" connector. Returns per-customer login /
// session telemetry. It is a stand-in behind the real connector interface —
// swapping this for a real Redshift client is isolated to this file. Values are
// derived deterministically from the customer id so results are stable.
// ---------------------------------------------------------------------------

const COUNTRIES = ["US", "GB", "DE", "CA", "FR", "AU", "BR", "JP"];

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100000;
  return h;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const riskLevel = searchParams.get("riskLevel");
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit")) || 25, 1),
    100,
  );

  // Simulate a warehouse query hop.
  await new Promise((r) => setTimeout(r, 90));

  const customers = await prisma.customer.findMany({
    where:
      riskLevel === "low" || riskLevel === "medium" || riskLevel === "high"
        ? { riskLevel }
        : {},
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  const rows = customers.map((c) => {
    const h = hash(c.id);
    const daysAgo = h % 30;
    const lastSeen = new Date(Date.now() - daysAgo * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return {
      customerId: c.id,
      customer: c.name,
      lastSeen,
      sessions30d: h % 40,
      ipAddress: `${h % 255}.${(h * 7) % 255}.${(h * 13) % 255}.${(h * 17) % 255}`,
      country: COUNTRIES[h % COUNTRIES.length],
    };
  });

  return NextResponse.json({ warehouse: "redshift-events", rows });
}
