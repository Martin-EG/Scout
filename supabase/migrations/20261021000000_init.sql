-- Scout initial schema: projects, venues, leads, drafts, runs, clicks.
-- Every child row hangs off a project; RLS grants access only to the project's owner.
-- The worker uses the service role key, which bypasses RLS.

-- ---------------------------------------------------------------- tables

create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null,
  url          text not null,
  description  text not null default '',
  audience     text not null default '',
  problems     text not null default '',
  keywords_es  text[] not null default '{}',
  keywords_en  text[] not null default '{}',
  tone         text not null default '',
  region       text not null default '',
  created_at   timestamptz not null default now()
);

create table public.venues (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  kind            text not null check (kind in ('searchable', 'manual')),
  platform        text not null,
  name            text not null,
  url             text,
  rules           text,
  link_policy     text,
  fit_score       real,
  status          text not null default 'watching'
                  check (status in ('watching', 'active', 'dead', 'banned')),
  last_posted_at  timestamptz
);

create table public.runs (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  status       text not null default 'queued'
               check (status in ('queued', 'running', 'done', 'failed')),
  started_at   timestamptz,
  finished_at  timestamptz,
  queries      jsonb not null default '[]'::jsonb,
  hits_found   integer not null default 0,
  leads_kept   integer not null default 0,
  error        text,
  created_at   timestamptz not null default now()
);

create table public.leads (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects (id) on delete cascade,
  venue_id         uuid references public.venues (id) on delete cascade,
  run_id           uuid references public.runs (id) on delete cascade,
  source           text not null,
  url              text not null,
  title            text not null,
  snippet          text,
  posted_at        timestamptz,
  intent_score     real,
  relevance_score  real,
  reason           text,
  status           text not null default 'new'
                   check (status in ('new', 'drafted', 'dismissed')),
  created_at       timestamptz not null default now()
);

create table public.drafts (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  lead_id     uuid references public.leads (id) on delete cascade,
  venue_id    uuid references public.venues (id) on delete cascade,
  body        text not null,
  language    text not null default 'en',
  status      text not null default 'pending'
              check (status in ('pending', 'approved', 'posted', 'rejected')),
  utm_url     text,
  posted_at   timestamptz,
  created_at  timestamptz not null default now()
);

create table public.clicks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  venue_id    uuid references public.venues (id) on delete cascade,
  draft_id    uuid references public.drafts (id) on delete cascade,
  clicked_at  timestamptz not null default now(),
  referrer    text
);

-- ---------------------------------------------------------------- indexes

create unique index leads_project_url_key on public.leads (project_id, url);

create index projects_user_id_idx on public.projects (user_id);
create index venues_project_id_idx on public.venues (project_id);
create index leads_project_status_idx on public.leads (project_id, status);
create index leads_run_id_idx on public.leads (run_id);
create index leads_venue_id_idx on public.leads (venue_id);
create index drafts_project_id_idx on public.drafts (project_id);
create index drafts_lead_id_idx on public.drafts (lead_id);
create index drafts_venue_id_idx on public.drafts (venue_id);
create index runs_project_created_idx on public.runs (project_id, created_at desc);
create index runs_status_created_idx on public.runs (status, created_at);
create index clicks_project_id_idx on public.clicks (project_id);
create index clicks_venue_id_idx on public.clicks (venue_id);
create index clicks_draft_id_idx on public.clicks (draft_id);

-- ---------------------------------------------------------------- RLS

-- True when the signed-in user owns the project. security definer + fixed
-- search_path so child-table policies don't recurse through projects' RLS.
create or replace function public.owns_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.user_id = (select auth.uid())
  );
$$;

revoke all on function public.owns_project(uuid) from public;
grant execute on function public.owns_project(uuid) to authenticated;

alter table public.projects enable row level security;
alter table public.venues   enable row level security;
alter table public.leads    enable row level security;
alter table public.drafts   enable row level security;
alter table public.runs     enable row level security;
alter table public.clicks   enable row level security;

create policy "projects: owner full access" on public.projects
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "venues: project owner full access" on public.venues
  for all to authenticated
  using (public.owns_project(project_id))
  with check (public.owns_project(project_id));

create policy "leads: project owner full access" on public.leads
  for all to authenticated
  using (public.owns_project(project_id))
  with check (public.owns_project(project_id));

create policy "drafts: project owner full access" on public.drafts
  for all to authenticated
  using (public.owns_project(project_id))
  with check (public.owns_project(project_id));

create policy "runs: project owner full access" on public.runs
  for all to authenticated
  using (public.owns_project(project_id))
  with check (public.owns_project(project_id));

-- Clicks are written by the public UTM redirect via the service role; owners read them.
create policy "clicks: project owner read" on public.clicks
  for select to authenticated
  using (public.owns_project(project_id));
