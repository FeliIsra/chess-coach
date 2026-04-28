import Link from "next/link";
import { normaliseLocale, requireAdmin } from "@/lib/auth";

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AdminLayout({
  children,
  params,
}: AdminLayoutProps) {
  const { locale: rawLocale } = await params;
  const locale = normaliseLocale(rawLocale);
  await requireAdmin(locale);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 md:flex-row">
      <aside className="md:w-52 shrink-0">
        <div className="rounded-xl border border-border bg-surface-1 p-3 text-sm">
          <p className="px-2 pb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Backoffice
          </p>
          <nav className="flex flex-col gap-0.5">
            <Link
              href={`/${locale}/admin`}
              className="rounded-md px-2 py-1.5 hover:bg-surface-2"
            >
              Overview
            </Link>
            <Link
              href={`/${locale}/admin/reports`}
              className="rounded-md px-2 py-1.5 hover:bg-surface-2"
            >
              Reports
            </Link>
            <span
              aria-disabled
              className="rounded-md px-2 py-1.5 text-muted-foreground/60"
              title="Coming soon"
            >
              Users
            </span>
          </nav>
        </div>
      </aside>
      <section className="flex-1 min-w-0">{children}</section>
    </div>
  );
}
