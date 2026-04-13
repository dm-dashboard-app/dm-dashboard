# DM Dashboard — Project Brief

Last updated: April 13, 2026 (imports tab now exposes live degraded-row list/export + spell import control)

Purpose: This document is the current-state/background brief for DM Dashboard. It describes what the app now is, what is materially landed, and what principles future work must preserve.

This is not the roadmap. For open work and planning tracks, use `docs/NEXT_STEPS.md`.

## Source-of-truth order

1. Live GitHub repo
2. Next Steps Brief
3. This Project Brief

If this brief conflicts with the live repo, the live repo wins.

## Project Overview

DM Dashboard is a mobile-first, session-oriented tabletop companion with distinct DM, player, and display surfaces.

Core product character:

- built for real live play (not just prep)
- fast session operation under phone constraints
- clear role boundaries between DM, player, and display
- safe handling of hidden/sensitive combat information

## Durable Product Baseline (landed)

### 1) Session-first architecture and role separation

Landed baseline:

- separate DM / player / display experiences
- session/encounter runtime state layered over durable profile setup
- hidden-info behavior preserved outside DM view where required

Preservation rule:

- keep DM authority, player usability, and display-safe output clearly separated

### 2) Player profile + derived character foundation

Landed baseline includes:

- multiclass-aware profiles
- derived stats/modifiers/saves/skills support
- hit dice and initiative derivation support
- spell DC / spell attack derivation support
- profile-first resource and capability modeling

Preservation rule:

- durable character identity/capability belongs in profile state; temporary encounter effects belong in runtime overlay

### 3) Player card and combat presentation baseline

Landed baseline includes:

- stabilized compact player-card and initiative presentation
- clear AC / PP / spell DC / spell attack visibility
- improved HP readability with DM temp HP and bonus max HP handling
- concentration/reaction presentation tuned for fast scan
- initiative numeric edit and concentration picker DM workflows
- hidden enemy AC/HP protections outside DM contexts
- tab/focus artifact cleanup and runtime build marker verification behavior

Preservation rule:

- maintain dense-but-readable combat cards without regressing hidden-info safeguards

### 4) DM mobile shell baseline

Landed baseline includes:

- mobile-oriented DM shell and bottom-dock interaction model
- practical tab grouping and fast in-session action reach
- stabilized alert/notification handling for live play

Preservation rule:

- prioritize one-handed mobile practicality over desktop-first UI assumptions

### 5) Spell + rest operational baseline

Landed baseline includes:

- spell library and spell-management foundation
- runtime spell access/preparation/concentration workflows
- known/prepared runtime viewing model
- long-rest preparation procedure integrated into long-rest flow
- short-rest extension support (including Song of Rest path)

Preservation rule:

- treat rest/spell behavior as rules-sensitive and shared-logic driven; avoid fragmented per-surface rewrites

### 6) Display world-map baseline

Landed baseline includes:

- DM-controlled display map mode from Manage → Session → Display Screen
- saved map URL state with DM toggle control
- forced display map-only rendering while enabled
- map pan/zoom interactions inside display mode

Preservation rule:

- DM owns display control state; display renders but does not self-govern mode

### 7) Monster/NPC archive baseline

Landed baseline includes:

- archive/unarchive flow for monster/NPC templates
- default active lists remain cleaner for session use
- non-destructive recovery path for archived templates

Preservation rule:

- keep archive operations reversible and admin-friendly

### 8) Display presentation mode baseline

Landed baseline includes:

- display-only presentation modes: **In Combat** and **Out of Combat**
- DM-managed display mode control from Manage → Session without changing DM/player layouts
- automatic display switch to In Combat when DM triggers Initiative roll workflow
- in-combat display containment: one featured player card, capped 4-slot initiative window, and compact name+initiative order rail
- out-of-combat display layout tuned for table screens with up to four side-by-side full player cards

Preservation rule:

- keep display-specific density/containment decisions isolated to display view while preserving role boundaries and hidden-info behavior


### 9) Supabase security hardening baseline (first pass)

Landed baseline includes:

- RLS enabled on previously flagged public tables
- first-pass policies added for `app_settings`, `alerts`, `profile_monster_spells`, `profile_player_spells`, and `spells`
- flagged functions updated with explicit `search_path`
- `combatants_public` recreated as `security_invoker = true` with read-only (`SELECT`) grants

Preservation rule:

- treat remaining advisor yellows as intentionally deferred access-model hardening work and tighten table-by-table with app-path validation (not blind policy sweeps)



### 10) Item-master foundation baseline (Stage 1)

Landed baseline includes:

- standalone reusable `item_master` entity design (not embedded in shops)
- controlled 2014-only import lane for SRD equipment + magic-item catalog seeding
- rerunnable deduped upsert semantics keyed by stable external identity
- durable magic-price overlay wiring from `docs/data/shop_magic_pricing_2014.json`
- source/rules metadata markers to preserve future 2014-safe filtering

Preservation rule:

- keep item catalog reusable across future shops and inventory/equipment work; do not collapse item definitions into shop rows


### 11) DM-only world shops baseline (Stage 2)

Landed baseline includes:

- DM-shell **World** tab with a DM-only shops surface
- shop type + affluence controls for fast generation
- weighted stock generation using Stage 1 `item_master` catalog records
- saved shop entity + generated inventory rows that reference `item_master` (no item embedding)
- server-mediated RPC persistence for saved shops/inventory rows (no broad client table RW)
- trust boundary note: in current repo model, Supabase authenticated maps to DM path while player/display use local join-code or display-token flows
- generated row pricing outputs (quantity, listed price, minimum barter price, barter DC)
- compact item detail modal for in-session adjudication

Preservation rule:

- keep shop data separated from reusable item catalog records and keep world-shop UI DM-only

### 12) Magic overlay curation baseline (Stage 3)

Landed baseline includes:

- magic stock generation now uses overlay-informed metadata (`shop_bucket`, pricing-overlay exclusion metadata, suggested pricing presence) to affect eligibility and weighted selection
- explicit suppression of excluded/manual/unpriced/gamechanging/special buckets from default generated stock
- stronger magic-shop curation defaults: lower row counts, reduced duplicate churn, and utility/consumable/noncombat bias over chaotic high-end swings
- affluence-aware magic rarity behavior where poor/modest shops strongly suppress high-rarity entries and wealthy shops can surface broader rarity bands
- preserved Stage 2 save/regenerate and DM-only world-shop UX while adding lightweight item-detail curation context (bucket and pricing basis)

Preservation rule:

- keep default generation safe-by-default for special/problematic magic items while leaving manual curation to future explicit phases


### 13) Custom/homebrew/private import lane baseline (Stage 4)

Landed baseline includes:

- DM Manage → Imports now hosts explicit one-action import controls for baseline SRD refresh and custom-seed import
- DM Manage → Imports also hosts the SRD spell import control so import admin actions are centralized in one tab
- import writes now run through a server-mediated RPC (`dm_import_item_master_rows`) instead of requiring terminal-only scripts for normal operator workflow
- SRD refresh now degrades safely: index-derived fallback rows are still imported for catalog continuity, but those degraded rows are explicitly quarantined (`metadata_json.degraded_import=true`, `shop_bucket=fallback_quarantine`, `is_shop_eligible=false`) so they cannot pollute default shop generation or pricing paths
- custom seed defaults are now explicit and safe: `docs/data/shop_custom_items_seed_2014.json` is intentionally empty-by-default, while prior sample rows live in `docs/data/shop_custom_items_seed_2014.example.json` as example/demo content
- preserved generation safety: only `is_shop_eligible=true` and `rules_era=2014` rows can enter Stage 2/3 generation

Preservation rule:

- keep custom-content import controlled/reviewable in Git and avoid parallel shop-only item stores

### 14) Degraded SRD repair overlay + rehydration path baseline

Landed baseline includes:

- repair data comes from durable repo artifact `docs/data/shop_srd_degraded_repairs_2014.json` (served in-app from `public/data/shop_srd_degraded_repairs_2014.json`)
- degraded rows remain quarantined and excluded from shop generation by default
- SRD refresh now auto-reports the live degraded/quarantined SRD row set from current `item_master` rows immediately after import (no separate report-generation button)
- Manage → Imports now exposes that same live degraded/quarantined SRD row set directly as a readable row list with copy/export JSON actions for repair workflows
- degraded repair coverage is now audited against `docs/degraded-srd-item-master-rows.json` in one batch (307 target rows): 283 rows have trustworthy repair overlay coverage and 24 remain explicitly quarantined only where trustworthy magic pricing data is still unavailable even after family-level alias matching

Preservation rule:

- keep quarantine default-on for degraded SRD fallbacks and only clear it through explicit trustworthy repair data

## Architectural / Product Principles for Future Work

- mobile-first practicality for real table use
- session stability over clever but fragile rewrites
- shared rules/modifier logic over duplicated component-local hacks
- profile-first durable setup with encounter-state runtime overlay
- preserve DM/player/display role boundaries and RLS-sensitive behavior

## Future-facing note

Inventory/equipment/abilities is currently a **planning track**, not landed baseline behavior. If pursued later, it should be phased and aligned with shared modifier-logic architecture (as outlined in `docs/NEXT_STEPS.md`).
