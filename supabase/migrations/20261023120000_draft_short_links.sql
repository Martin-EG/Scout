-- Day 4: every draft gets a short tracking link /r/<short_code> that logs a click
-- and redirects to its utm_url.
alter table public.drafts add column short_code text;
create unique index drafts_short_code_key on public.drafts (short_code);
