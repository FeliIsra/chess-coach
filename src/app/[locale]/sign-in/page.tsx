import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUser, normaliseLocale } from "@/lib/auth";
import SignInForm from "@/components/sign-in-form";

interface SignInPageProps {
  params: Promise<{ locale: string }>;
}

export default async function SignInPage({ params }: SignInPageProps) {
  const { locale: rawLocale } = await params;
  const locale = normaliseLocale(rawLocale);

  const user = await getUser();
  if (user) {
    redirect(`/${locale}/app`);
  }

  return (
    <Suspense>
      <SignInForm locale={locale} />
    </Suspense>
  );
}
