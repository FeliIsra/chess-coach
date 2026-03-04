create extension if not exists "pgcrypto";

create table if not exists public.analysis_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  username text not null,
  games_count integer not null check (games_count > 0),
  total_blunders integer not null check (total_blunders >= 0),
  total_mistakes integer not null check (total_mistakes >= 0),
  average_accuracy double precision not null check (average_accuracy >= 0 and average_accuracy <= 100),
  avg_blunders_per_game double precision not null check (avg_blunders_per_game >= 0)
);

create index if not exists analysis_sessions_username_created_at_idx
  on public.analysis_sessions (username, created_at desc);

alter table public.analysis_sessions enable row level security;
