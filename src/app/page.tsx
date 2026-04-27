import { redirect } from "next/navigation";
import { DEFAULT_LOCALE } from "@/lib/auth";

// Root entry — redirect to the default locale. WT-J (i18n) will eventually
// detect locale from cookie / Accept-Language here.
export default function RootPage() {
  redirect(`/${DEFAULT_LOCALE}`);
}
