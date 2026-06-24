import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}
