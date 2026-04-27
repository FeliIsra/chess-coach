-- WT-G: chess_accounts table — multiple platform handles per user.
-- Owns: WT-G (auth-and-profile).

create table if not exists public.chess_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null default 'chess.com',
  handle text not null,
  time_class_default text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, platform, handle)
);

create index if not exists chess_accounts_user_id_idx on public.chess_accounts (user_id);

alter table public.chess_accounts enable row level security;

drop policy if exists "chess_accounts_select_own" on public.chess_accounts;
create policy "chess_accounts_select_own"
  on public.chess_accounts
  for select
  using (auth.uid() = user_id);

drop policy if exists "chess_accounts_insert_own" on public.chess_accounts;
create policy "chess_accounts_insert_own"
  on public.chess_accounts
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "chess_accounts_update_own" on public.chess_accounts;
create policy "chess_accounts_update_own"
  on public.chess_accounts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "chess_accounts_delete_own" on public.chess_accounts;
create policy "chess_accounts_delete_own"
  on public.chess_accounts
  for delete
  using (auth.uid() = user_id);
