import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Mocked external "risk-scoring microservice" — the SECOND data source.
// It is intentionally separate from the primary Postgres read tools: it returns
// its own model-scored shape (score/band/model) rather than raw table rows, and
// adds a little latency to mimic a network call. The app surfaces it through the
// RiskScorePanel component, demonstrating "data from more than one place".
// ---------------------------------------------------------------------------

const MODEL_NAME = "risk-model-v2";

// Deterministic pseudo-score from the customer id so results are stable.
function scoreFor(id: string, riskLevel: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 1000;
  }
  const base = riskLevel === "high" ? 70 : riskLevel === "medium" ? 40 : 10;
  return Math.min(99, base + (hash % 30));
}

function band(score: number): string {
  if (score >= 70) return "Critical";
  if (score >= 40) return "Elevated";
  return "Nominal";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const riskLevel = searchParams.get("riskLevel");
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit")) || 25, 1),
    100,
  );

  // Simulate an external network hop.
  await new Promise((r) => setTimeout(r, 120));

  const customers = await prisma.customer.findMany({
    where:
      riskLevel === "low" || riskLevel === "medium" || riskLevel === "high"
        ? { riskLevel }
        : {},
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  const scores = customers
    .map((c) => {
      const score = scoreFor(c.id, c.riskLevel);
      return {
        customerId: c.id,
        customer: c.name,
        score,
        band: band(score),
        model: MODEL_NAME,
      };
    })
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({ service: MODEL_NAME, scores });
}
