import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as
    | { language?: string }
    | null;
  const language = body?.language?.trim() ?? "";
  if (!(routing.locales as readonly string[]).includes(language)) {
    return NextResponse.json({ error: "Invalid language" }, { status: 400 });
  }
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ language, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
