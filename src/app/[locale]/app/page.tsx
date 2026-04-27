import { requireUser, normaliseLocale } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import AnalyzeClient from "./analyze-client";

interface AppPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AppPage({ params }: AppPageProps) {
  const { locale: rawLocale } = await params;
  const locale = normaliseLocale(rawLocale);
  const user = await requireUser(locale, `/${locale}/app`);

  let defaultUsername: string | undefined;
  try {
    const supabase = await getSupabaseServerClient();
    const { data } = await supabase
      .from("profiles")
      .select("default_chess_username")
      .eq("id", user.id)
      .maybeSingle();
    defaultUsername = data?.default_chess_username ?? undefined;
  } catch {
    defaultUsername = undefined;
  }

  return <AnalyzeClient defaultUsername={defaultUsername} />;
}
