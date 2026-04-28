import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { normaliseLocale, requireAdmin } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

interface ReportDetailProps {
  params: Promise<{ locale: string; id: string }>;
}

interface ReportRow {
  id: string;
  type: string;
  body: string;
  email: string | null;
  page_url: string | null;
  user_agent: string | null;
  status: string;
  created_at: string;
}

const STATUSES = ["new", "triaged", "done", "wont_do"] as const;

function fmt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default async function ReportDetailPage({
  params,
}: ReportDetailProps) {
  const { locale: rawLocale, id } = await params;
  const locale = normaliseLocale(rawLocale);
  await requireAdmin(locale);

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("reports")
    .select("id, type, body, email, page_url, user_agent, status, created_at")
    .eq("id", id)
    .maybeSingle<ReportRow>();

  if (!data) notFound();
  const report = data;

  async function updateStatus(formData: FormData) {
    "use server";
    const status = String(formData.get("status") ?? "");
    if (!STATUSES.includes(status as (typeof STATUSES)[number])) return;
    const supabase = await getSupabaseServerClient();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) redirect(`/${locale}/sign-in`);
    await supabase.from("reports").update({ status }).eq("id", id);
    revalidatePath(`/${locale}/admin/reports/${id}`);
    revalidatePath(`/${locale}/admin/reports`);
    revalidatePath(`/${locale}/admin`);
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/${locale}/admin/reports`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to reports
      </Link>

      <header className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground">
          {report.type}
        </span>
        <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground">
          status: {report.status}
        </span>
        <span className="text-xs text-muted-foreground">
          {fmt(report.created_at)}
        </span>
      </header>

      <article className="rounded-xl border border-border bg-surface-1 p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Body
        </h2>
        <p className="whitespace-pre-wrap text-sm text-foreground">
          {report.body}
        </p>
      </article>

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-md border border-border bg-surface-1 p-3">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Email
          </dt>
          <dd className="mt-1 break-all">
            {report.email ?? <span className="text-muted-foreground">—</span>}
          </dd>
        </div>
        <div className="rounded-md border border-border bg-surface-1 p-3">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Page URL
          </dt>
          <dd className="mt-1 break-all">
            {report.page_url ?? <span className="text-muted-foreground">—</span>}
          </dd>
        </div>
        <div className="rounded-md border border-border bg-surface-1 p-3 sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            User agent
          </dt>
          <dd className="mt-1 break-all font-mono text-xs">
            {report.user_agent ?? (
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
        </div>
      </dl>

      <form
        action={updateStatus}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface-1 p-4"
      >
        <label className="flex flex-col text-xs font-medium text-muted-foreground">
          Change status
          <select
            name="status"
            defaultValue={report.status}
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Save
        </button>
      </form>
    </div>
  );
}
