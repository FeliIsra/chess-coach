import { redirect } from "next/navigation";
import { getUser, normaliseLocale } from "@/lib/auth";
import SignUpForm from "@/components/sign-up-form";

interface SignUpPageProps {
  params: Promise<{ locale: string }>;
}

export default async function SignUpPage({ params }: SignUpPageProps) {
  const { locale: rawLocale } = await params;
  const locale = normaliseLocale(rawLocale);

  const user = await getUser();
  if (user) {
    redirect(`/${locale}/app`);
  }

  return <SignUpForm locale={locale} />;
}
