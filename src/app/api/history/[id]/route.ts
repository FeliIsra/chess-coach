import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getAnalysisById } from "@/lib/analyses";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const user = await getUser();
  try {
    const data = await getAnalysisById(id, { userId: user?.id ?? null });
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/history/[id] failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
