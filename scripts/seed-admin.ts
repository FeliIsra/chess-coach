/**
 * Dev/staging-only admin seed.
 *
 * Creates `admin@chess-coach.local` with password `admin` and upserts the
 * matching `profiles` row with `role='admin'`.
 *
 * Usage:
 *   ALLOW_DEV_SEED=1 npm run seed:admin
 *
 * Refuses to run if NODE_ENV==='production' or ALLOW_DEV_SEED!=='1'.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  // Naive fallback: parse .env.local then .env in cwd.
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const line of raw.split("\n")) {
        if (line.startsWith(`${name}=`)) {
          return line.slice(name.length + 1).trim();
        }
      }
    } catch {
      // ignore
    }
  }
  return undefined;
}

const ADMIN_EMAIL = "admin@chess-coach.local";
const ADMIN_PASSWORD = "admin";

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed in production.");
    process.exit(1);
  }
  if (process.env.ALLOW_DEV_SEED !== "1") {
    console.error("ALLOW_DEV_SEED=1 not set. Refusing to run.");
    process.exit(1);
  }

  const url = loadEnv("NEXT_PUBLIC_SUPABASE_URL") ?? loadEnv("SUPABASE_URL");
  const serviceKey = loadEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const admin = createClient(url.trim(), serviceKey.trim(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Try to create the user; if email is taken, fetch by email.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  });

  let userId: string | undefined = created?.user?.id;
  if (createErr || !userId) {
    if (createErr && !/already (registered|exists)/i.test(createErr.message)) {
      console.error("Failed to create admin user:", createErr.message);
      process.exit(1);
    }
    // Look up the existing user.
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) {
      console.error("Failed to list users:", listErr.message);
      process.exit(1);
    }
    const existing = list.users.find(
      (u) => u.email?.toLowerCase() === ADMIN_EMAIL
    );
    if (!existing) {
      console.error(
        `User ${ADMIN_EMAIL} not found and could not be created. Aborting.`
      );
      process.exit(1);
    }
    userId = existing.id;
  }

  if (!userId) {
    console.error("Could not resolve admin user id.");
    process.exit(1);
  }

  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        display_name: "Admin",
        role: "admin",
        language: "en",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  if (profileErr) {
    console.error("Failed to upsert profile:", profileErr.message);
    process.exit(1);
  }

  console.log(
    `OK. Admin seeded: email=${ADMIN_EMAIL} password=${ADMIN_PASSWORD} role=admin`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
