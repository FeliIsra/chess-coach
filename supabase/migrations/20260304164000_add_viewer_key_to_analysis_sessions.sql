alter table public.analysis_sessions
  add column if not exists viewer_key text;

update public.analysis_sessions
set viewer_key = coalesce(viewer_key, 'legacy_' || md5(lower(username)))
where viewer_key is null;

alter table public.analysis_sessions
  alter column viewer_key set not null;

create index if not exists analysis_sessions_viewer_key_created_at_idx
  on public.analysis_sessions (viewer_key, created_at desc);
