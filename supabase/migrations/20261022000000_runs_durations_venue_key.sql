-- Day 2: per-step run timings and a natural key for venues so the worker can upsert them.

alter table public.runs
  add column step_durations jsonb not null default '{}'::jsonb;

comment on column public.runs.step_durations is
  'Milliseconds per pipeline step, e.g. {"plan": 41000, "search": 22000, "score": 95000}.';

create unique index venues_project_platform_name_key
  on public.venues (project_id, platform, name);
