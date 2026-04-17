-- Add durable manual AC modifier support on player profiles.
-- Safe additive migration: keeps existing profiles at 0 modifier.

alter table if exists public.profiles_players
  add column if not exists ac_bonus integer not null default 0;

comment on column public.profiles_players.ac_bonus is
  'Manual AC modifier layered on top of derived/base AC and item/effect contributions.';
