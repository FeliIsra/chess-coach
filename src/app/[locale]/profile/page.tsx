import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normaliseLocale, requireUser, SUPPORTED_LOCALES } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getEloHistory } from "@/lib/elo-progress";
import EloProgressChart from "@/components/elo-progress-chart";

interface ProfilePageProps {
  params: Promise<{ locale: string }>;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  default_chess_username: string | null;
  language: string | null;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { locale: rawLocale } = await params;
  const locale = normaliseLocale(rawLocale);
  const user = await requireUser(locale, `/${locale}/profile`);

  const supabase = await getSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, default_chess_username, language")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  const eloPoints = await getEloHistory(user.id);

  async function updateProfile(formData: FormData) {
    "use server";
    const display_name = (formData.get("display_name") as string | null)?.trim() || null;
    const default_chess_username =
      (formData.get("default_chess_username") as string | null)?.trim() || null;
    const language = ((formData.get("language") as string | null) || "en").trim();
    const safeLanguage = SUPPORTED_LOCALES.includes(
      language as (typeof SUPPORTED_LOCALES)[number]
    )
      ? language
      : "en";
    const supabase = await getSupabaseServerClient();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) redirect(`/${locale}/sign-in`);
    await supabase.from("profiles").upsert({
      id: u.user.id,
      display_name,
      default_chess_username,
      language: safeLanguage,
      updated_at: new Date().toISOString(),
    });
    revalidatePath(`/${locale}/profile`);
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account is independent from any Chess.com handle. Set a default
          username to skip the input on every analysis.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-surface-1 p-6">
        <h2 className="mb-4 text-lg font-semibold">Account</h2>
        <form action={updateProfile} className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium">Display name</span>
            <input
              name="display_name"
              type="text"
              defaultValue={profile?.display_name ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium">Default Chess.com username</span>
            <input
              name="default_chess_username"
              type="text"
              defaultValue={profile?.default_chess_username ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium">Language</span>
            <select
              name="language"
              defaultValue={profile?.language ?? "en"}
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            >
              {SUPPORTED_LOCALES.map((loc) => (
                <option key={loc} value={loc}>
                  {loc.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Save changes
            </button>
          </div>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Signed in as <span className="font-mono">{user.email}</span>
        </p>
      </section>

      <EloProgressChart points={eloPoints} />
    </main>
  );
}
