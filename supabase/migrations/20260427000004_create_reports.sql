-- WT-I.a: anonymous user reports (bug / feature / other)
-- Owner: WT-I.a. Coordinates with WT-G (creates public.profiles in 0001/0002)
-- and WT-J (i18n migrations 0003).
--
-- The admin SELECT/UPDATE policies below reference public.profiles(role).
-- That table is created by WT-G's migrations (20260427000001_* /
-- 20260427000002_*). When this migration is applied AFTER WT-G's, the
-- "admin via profiles" policy is created. If WT-G's migration has not
-- been applied yet (i.e. public.profiles does not exist), we fall back
-- to a service-role-only policy and emit a TODO. Once WT-G ships, run
-- the policy upgrade block at the bottom (or re-apply this migration
-- after WT-G's so the DO block takes the profiles branch).

create extension if not exists "pgcrypto";

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('bug', 'feature', 'other')),
  body text not null check (length(body) between 10 and 5000),
  email text,
  page_url text,
  user_agent text,
  status text not null default 'new'
    check (status in ('new', 'triaged', 'done', 'wont_do')),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists reports_created_at_idx
  on public.reports (created_at desc);

create index if not exists reports_status_created_at_idx
  on public.reports (status, created_at desc);

alter table public.reports enable row level security;

-- Anonymous insert: any caller (anon role) may submit a report.
-- Rate limiting + honeypot are enforced at the API layer; RLS just allows
-- the insert through. The service-role key bypasses RLS anyway, so this
-- mainly matters when/if we ever expose a public anon-key endpoint.
drop policy if exists "reports_anon_insert" on public.reports;
create policy "reports_anon_insert"
  on public.reports
  for insert
  to anon, authenticated
  with check (true);

-- Admin SELECT/UPDATE policies. These depend on public.profiles existing
-- (owned by WT-G). We use a DO block to detect the table at apply time.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'profiles'
  ) then
    -- profiles exists: wire admin access through profiles.role.
    execute $policy$
      drop policy if exists "reports_admin_select" on public.reports;
    $policy$;
    execute $policy$
      create policy "reports_admin_select"
        on public.reports
        for select
        to authenticated
        using (
          coalesce(auth.jwt() ->> 'role', '') = 'admin'
          or exists (
            select 1
            from public.profiles p
            where p.id = auth.uid()
              and p.role = 'admin'
          )
        );
    $policy$;

    execute $policy$
      drop policy if exists "reports_admin_update" on public.reports;
    $policy$;
    execute $policy$
      create policy "reports_admin_update"
        on public.reports
        for update
        to authenticated
        using (
          coalesce(auth.jwt() ->> 'role', '') = 'admin'
          or exists (
            select 1
            from public.profiles p
            where p.id = auth.uid()
              and p.role = 'admin'
          )
        )
        with check (
          coalesce(auth.jwt() ->> 'role', '') = 'admin'
          or exists (
            select 1
            from public.profiles p
            where p.id = auth.uid()
              and p.role = 'admin'
          )
        );
    $policy$;
  else
    -- TODO(WT-I.a -> WT-G): public.profiles does not exist yet. Falling
    -- back to a service-role-only policy. Once WT-G's migration lands and
    -- creates public.profiles, drop these fallback policies and re-create
    -- them with the profiles.role check (re-running this migration is
    -- safe, or write a follow-up migration).
    raise notice
      'public.profiles missing - reports admin policies degraded to service_role only';

    execute $policy$
      drop policy if exists "reports_admin_select" on public.reports;
    $policy$;
    execute $policy$
      create policy "reports_admin_select"
        on public.reports
        for select
        to authenticated
        using (auth.role() = 'service_role');
    $policy$;

    execute $policy$
      drop policy if exists "reports_admin_update" on public.reports;
    $policy$;
    execute $policy$
      create policy "reports_admin_update"
        on public.reports
        for update
        to authenticated
        using (auth.role() = 'service_role')
        with check (auth.role() = 'service_role');
    $policy$;
  end if;
end
$$;

comment on table public.reports is
  'Anonymous user-submitted bug reports / feature requests / other feedback.';
comment on column public.reports.email is
  'Optional contact email. Leave NULL to keep submission fully anonymous.';
comment on column public.reports.status is
  'Triage state. new -> triaged -> done | wont_do.';
