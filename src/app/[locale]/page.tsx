import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getUser, normaliseLocale } from "@/lib/auth";

interface LandingProps {
  params: Promise<{ locale: string }>;
}

export default async function LandingPage({ params }: LandingProps) {
  const { locale: rawLocale } = await params;
  const locale = normaliseLocale(rawLocale);

  const user = await getUser();
  if (user) {
    redirect(`/${locale}/app`);
  }

  const t = await getTranslations({ locale, namespace: "landing" });

  const valueProps = [
    {
      title: t("analyzeTitle"),
      body: t("analyzeBody"),
      icon: "♟︎",
    },
    {
      title: t("coachTitle"),
      body: t("coachBody"),
      icon: "✦",
    },
    {
      title: t("eloTitle"),
      body: t("eloBody"),
      icon: "↗︎",
    },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-7rem] top-[-5rem] h-72 w-72 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute right-[-6rem] top-24 h-64 w-64 rounded-full bg-accent-blue/10 blur-3xl" />
      </div>

      <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pb-16 pt-12 text-center md:px-6 md:pb-24 md:pt-20">
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted">
          {t("kicker")}
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl">
          {t("headline")}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-foreground/70 md:text-lg">
          {t("lede")}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/${locale}/sign-up`}
            className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            {t("ctaSignUp")}
          </Link>
          <Link
            href={`/${locale}/sign-in`}
            className="rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-surface-2"
          >
            {t("ctaSignIn")}
          </Link>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-4 px-4 pb-20 md:grid-cols-3 md:px-6">
        {valueProps.map((prop) => (
          <article key={prop.title} className="surface-frame rounded-2xl p-6">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-lg text-primary">
              <span aria-hidden>{prop.icon}</span>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-foreground">
              {prop.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-foreground/70">
              {prop.body}
            </p>
          </article>
        ))}
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        {t("footer")}
      </footer>
    </main>
  );
}
