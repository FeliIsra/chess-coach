import Link from "next/link";
import { normaliseLocale, requireUser } from "@/lib/auth";
import { listAnalyses } from "@/lib/analyses";
import { getEloHistory } from "@/lib/elo-progress";
import EloProgressChart from "@/components/elo-progress-chart";

interface HistoryPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ chess_username?: string; time_class?: string }>;
}

const TIME_CLASS_OPTIONS = ["all", "bullet", "blitz", "rapid", "daily"] as const;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function HistoryPage({
  params,
  searchParams,
}: HistoryPageProps) {
  const { locale: rawLocale } = await params;
  const locale = normaliseLocale(rawLocale);
  const user = await requireUser(locale, `/${locale}/history`);
  const sp = await searchParams;
  const chessUsername = sp.chess_username?.trim() || undefined;
  const timeClass =
    sp.time_class && sp.time_class !== "all" ? sp.time_class : undefined;

  const [analyses, eloPoints] = await Promise.all([
    listAnalyses(user.id, { chessUsername, timeClass, limit: 100 }),
    getEloHistory(user.id, { chessUsername, timeClass }),
  ]);

  const usernames = Array.from(
    new Set(analyses.map((a) => a.username))
  ).sort();

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your history</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every analysis you&apos;ve run, plus how your rating has moved over time.
          </p>
        </div>
        <Link
          href={`/${locale}/app`}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Run a new analysis
        </Link>
      </header>

      <EloProgressChart points={eloPoints} />

      <section className="space-y-4">
        <form
          method="get"
          className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface-1 p-4"
        >
          <label className="flex flex-col text-xs font-medium text-muted-foreground">
            Chess.com username
            <select
              name="chess_username"
              defaultValue={chessUsername ?? ""}
              className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">All</option>
              {usernames.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs font-medium text-muted-foreground">
            Time class
            <select
              name="time_class"
              defaultValue={sp.time_class ?? "all"}
              className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {TIME_CLASS_OPTIONS.map((tc) => (
                <option key={tc} value={tc}>
                  {tc}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-surface-3"
          >
            Apply
          </button>
        </form>

        {analyses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No analyses yet for this filter.{" "}
            <Link
              href={`/${locale}/app`}
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              Run your first analysis
            </Link>
            .
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {analyses.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/${locale}/history/${a.id}`}
                  className="block rounded-xl border border-border bg-surface-1 p-4 transition-colors hover:border-primary/60 hover:bg-surface-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold tracking-tight">
                      {a.username}
                    </h3>
                    <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                      {a.timeClass ?? "mixed"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {fmtDate(a.date)}
                  </p>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Games</dt>
                      <dd className="text-base font-semibold">{a.gamesCount}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Blunders</dt>
                      <dd className="text-base font-semibold">{a.totalBlunders}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Accuracy</dt>
                      <dd className="text-base font-semibold">
                        {a.averageAccuracy
                          ? `${Math.round(a.averageAccuracy)}%`
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
