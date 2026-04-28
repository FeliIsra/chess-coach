import Link from "next/link";
import { normaliseLocale } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

interface AdminHomeProps {
  params: Promise<{ locale: string }>;
}

interface ReportRow {
  type: string;
  status: string;
}

const STATUSES = ["new", "triaged", "done", "wont_do"] as const;
const TYPES = ["bug", "feature", "other"] as const;

export default async function AdminHome({ params }: AdminHomeProps) {
  const { locale: rawLocale } = await params;
  const locale = normaliseLocale(rawLocale);
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("reports")
    .select("type, status")
    .returns<ReportRow[]>();

  const rows = data ?? [];
  const total = rows.length;
  const byStatus = Object.fromEntries(
    STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length])
  );
  const byType = Object.fromEntries(
    TYPES.map((t) => [t, rows.filter((r) => r.type === t).length])
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Backoffice</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Operational view of incoming reports.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Reports — by status
        </h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={`/${locale}/admin/reports?status=${s}`}
              className="rounded-xl border border-border bg-surface-1 p-4 hover:border-primary/60"
            >
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {s}
              </div>
              <div className="mt-1 text-3xl font-semibold">{byStatus[s] ?? 0}</div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Reports — by type
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {TYPES.map((t) => (
            <Link
              key={t}
              href={`/${locale}/admin/reports?type=${t}`}
              className="rounded-xl border border-border bg-surface-1 p-4 hover:border-primary/60"
            >
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {t}
              </div>
              <div className="mt-1 text-3xl font-semibold">{byType[t] ?? 0}</div>
            </Link>
          ))}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">Total reports: {total}</p>
    </div>
  );
}
