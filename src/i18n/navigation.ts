import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation primitives. Use these in client components instead of
 * Next.js' raw `Link`/`useRouter`/etc so that pathnames preserve the active
 * locale segment automatically.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
