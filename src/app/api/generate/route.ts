import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { generateSpec } from "@/lib/llm";
import { writeAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { prompt?: string };
  const prompt = (body.prompt || "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  // The role passed here governs which actions survive into the spec. The model
  // never sees or decides permissions.
  const { spec, source } = await generateSpec(prompt, user.role);

  await writeAudit({
    user,
    kind: "generation",
    name: "generateTool",
    params: {
      prompt,
      source,
      components: spec.components.map((c) => c.component),
      actions: spec.actions.map((a) => a.action),
    },
  });

  return NextResponse.json({ spec, source });
}
