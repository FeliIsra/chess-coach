import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser, normaliseLocale } from "@/lib/auth";
import { getAnalysisById } from "@/lib/analyses";
import ResultsClient from "./results-client";

interface DetailPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function HistoryDetailPage({ params }: DetailPageProps) {
  const { locale: rawLocale, id } = await params;
  const locale = normaliseLocale(rawLocale);
  const user = await getUser();

  const data = await getAnalysisById(id, { userId: user?.id ?? null });
  if (!data) notFound();

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/${locale}/history`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to history
        </Link>
        <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground">
          {data.session.timeClass ?? "mixed"}
        </span>
      </div>
      <ResultsClient
        result={data.result}
        analyzedUsername={data.session.username}
        backHref={`/${locale}/history`}
      />
    </main>
  );
}
