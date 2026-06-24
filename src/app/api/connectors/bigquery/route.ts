import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Mocked BigQuery "marketing analytics warehouse" connector. Returns per-
// customer lifetime spend and marketing analytics. Stand-in behind the real
// connector interface; values derived deterministically from the customer id.
// ---------------------------------------------------------------------------

const CATEGORIES = [
  "Travel",
  "Groceries",
  "Electronics",
  "Dining",
  "Subscriptions",
  "Fuel",
];

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 37 + id.charCodeAt(i)) % 100000;
  return h;
}

function ltvBand(spend: number): string {
  if (spend >= 7000) return "Platinum";
  if (spend >= 4000) return "Gold";
  if (spend >= 2000) return "Silver";
  return "Bronze";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const riskLevel = searchParams.get("riskLevel");
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit")) || 25, 1),
    100,
  );

  // Simulate a warehouse query hop.
  await new Promise((r) => setTimeout(r, 110));

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
    const lifetimeSpend = 500 + (h % 9000);
    return {
      customerId: c.id,
      customer: c.name,
      lifetimeSpend,
      topCategory: CATEGORIES[h % CATEGORIES.length],
      ltvBand: ltvBand(lifetimeSpend),
    };
  });

  return NextResponse.json({ warehouse: "bigquery-analytics", rows });
}
