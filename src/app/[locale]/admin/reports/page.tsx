import Link from "next/link";
import { normaliseLocale } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

interface ReportsListProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    status?: string;
    type?: string;
    q?: string;
  }>;
}

interface ReportRow {
  id: string;
  type: string;
  body: string;
  email: string | null;
  page_url: string | null;
  status: string;
  created_at: string;
}

const STATUSES = ["new", "triaged", "done", "wont_do"] as const;
const TYPES = ["bug", "feature", "other"] as const;

const STATUS_BADGE_CLASS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-400",
  triaged: "bg-amber-500/10 text-amber-400",
  done: "bg-emerald-500/10 text-emerald-400",
  wont_do: "bg-zinc-500/10 text-zinc-400",
};

function fmt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ReportsListPage({
  params,
  searchParams,
}: ReportsListProps) {
  const { locale: rawLocale } = await params;
  const locale = normaliseLocale(rawLocale);
  const sp = await searchParams;
  const supabase = await getSupabaseServerClient();
  const status = sp.status?.trim() || "";
  const type = sp.type?.trim() || "";
  const q = sp.q?.trim() || "";

  let query = supabase
    .from("reports")
    .select("id, type, body, email, page_url, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) query = query.eq("status", status);
  if (type) query = query.eq("type", type);
  if (q) query = query.ilike("body", `%${q}%`);

  const { data, error } = await query.returns<ReportRow[]>();
  const reports = data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Anonymous bug reports and feature requests.
        </p>
      </header>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface-1 p-4"
      >
        <label className="flex flex-col text-xs font-medium text-muted-foreground">
          Status
          <select
            name="status"
            defaultValue={status}
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs font-medium text-muted-foreground">
          Type
          <select
            name="type"
            defaultValue={type}
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">All</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs font-medium text-muted-foreground">
          Search body
          <input
            name="q"
            defaultValue={q}
            type="text"
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            placeholder="keyword..."
          />
        </label>
        <button
          type="submit"
          className="rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-surface-3"
        >
          Filter
        </button>
      </form>

      {error ? (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Could not load reports: {error.message}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No reports match the current filter.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface-1">
          {reports.map((r) => (
            <li key={r.id}>
              <Link
                href={`/${locale}/admin/reports/${r.id}`}
                className="block px-4 py-3 hover:bg-surface-2"
              >
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={
                      "rounded-full px-2 py-0.5 font-medium uppercase tracking-wide " +
                      (STATUS_BADGE_CLASS[r.status] ?? "bg-zinc-500/10 text-zinc-400")
                    }
                  >
                    {r.status}
                  </span>
                  <span className="rounded-full border border-border px-2 py-0.5 uppercase tracking-wide text-muted-foreground">
                    {r.type}
                  </span>
                  <span className="ml-auto text-muted-foreground">{fmt(r.created_at)}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-foreground">{r.body}</p>
                {(r.email || r.page_url) && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {r.email ? `from ${r.email} · ` : ""}
                    {r.page_url ?? ""}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
