-- Short-rest active-cycle marker on encounters
-- Adds a player-readable short-rest state source that does not depend on combat_log visibility.

alter table public.encounters
  add column if not exists short_rest_active boolean not null default false;

alter table public.encounters
  add column if not exists short_rest_started_at timestamptz null;

comment on column public.encounters.short_rest_active is
  'True while a short-rest procedure cycle is active (DM-started, not yet cancelled/completed).';

comment on column public.encounters.short_rest_started_at is
  'UTC timestamp for the currently active short-rest cycle start; null when no cycle is active.';
