import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import Header from "@/components/header";
import { getUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;
  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();

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
      displayName = null;
      isAdmin = false;
    }
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <Header
        locale={locale}
        user={user}
        displayName={displayName}
        isAdmin={isAdmin}
      />
      {children}
    </NextIntlClientProvider>
  );
}
