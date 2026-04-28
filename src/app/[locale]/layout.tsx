// NOTE: WT-J (i18n) will replace this with NextIntlClientProvider — keep this minimal.
import { notFound } from "next/navigation";
import Header from "@/components/header";
import { getUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const SUPPORTED_LOCALES = ["en", "es", "pt"] as const;

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    notFound();
  }

  const user = await getUser();
  let displayName: string | null = null;
  let isAdmin = false;

  if (user) {
    try {
      const supabase = await getSupabaseServerClient();
      const { data } = await supabase
        .from("profiles")
        .select("display_name, role")
        .eq("id", user.id)
        .maybeSingle<{ display_name: string | null; role: string | null }>();
      displayName = data?.display_name ?? null;
      isAdmin = data?.role === "admin";
    } catch {
      // Profile fetch is best-effort for the header label.
      displayName = null;
      isAdmin = false;
    }
  }

  return (
    <>
      <Header
        locale={locale}
        user={user}
        displayName={displayName}
        isAdmin={isAdmin}
      />
      {children}
    </>
  );
}
