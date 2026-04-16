# DM Dashboard — Next Steps Brief

Last updated: April 16, 2026 (roadmap reset: future development promoted, validation/security follow-up parked)

Purpose: This file is the active roadmap only. It lists active next steps, intentionally parked/deferred work, and longer-range ideas.

## Source-of-truth order

1. Live GitHub repo
2. This Next Steps Brief
3. Project Brief for background/current-state context

If this document conflicts with the live repo, the live repo wins.

## Current Position

The current `main` baseline already includes the major stabilization, spell/rest runtime, display map, world tabs, NPC portrait, item-master/shop pipeline, and Inventory Phase 1 + rewards/assignment rebuild tracks.

This roadmap should focus on what to build next, not re-open already-landed baseline behavior unless a reproducible regression is found on current `main`.

## Active Next Steps (current roadmap)

### 1) Inventory / Equipment / Abilities — post-Phase-1 delivery track

Goal: continue from landed Inventory Phase 1 into phased character-capability expansion without unsafe all-at-once rules rewrites.

#### Phase 2 — equipment / attunement state

- add equipped / unequipped and attuned / unattuned state
- support practical item categories (armor / weapon / shield / wondrous)
- keep initial implementation state-driven (avoid broad derived-math rewrites in this phase)

#### Phase 3 — shared mechanical effect engine (high-risk; architecture-first)

- implement one shared modifier pipeline (no per-component math patches)
- target future derived influence areas through that shared path (AC, saves, stats, spell DC/attack, initiative)
- keep this as a contained architecture batch before any wide UI/rules fan-out

#### Sibling track — abilities / boons

- model passive/descriptive abilities separately from limited-use resources
- support class/background/species/feat-style boons as a sibling system (not “resource system 2”)
- start tracked/descriptive first; only connect to modifier automation through the shared engine when ready

#### Explicit delivery guardrails

- do not combine equipment, attunement, full mechanical effects, and abilities into one leap
- preserve profile-first durable state plus encounter-runtime overlay model
- centralize shared modifier logic; avoid duplicated surface-level formulas

### 2) Spell architecture follow-up — subclass-granted spell modeling

Goal: close known modeling gaps for subclass spell access while preserving current role/runtime correctness.

- represent subclass-granted off-list spells distinctly from ordinary learned/prepared rows
- support always-prepared subclass spells without consuming ordinary prep slots
- avoid fragile per-view exceptions across DM/player/runtime spell surfaces

### 3) World and management product-development follow-ups (usage-driven)

- world-map quality-of-life improvements (for example: map presets / recurring scenes) when table usage justifies it
- archive/management surface improvements (for example: better filtering/search in large monster/NPC libraries) when repeated admin friction is validated

### 4) Conservative code-health batches (after product track slices)

- legacy initiative path decision (`src/components/InitiativePanel.js`)
- DMView de-densify/extraction (`src/views/DMView.js`) as isolated maintenance
- hook/dependency hygiene and stale compatibility-path cleanup in contained low-risk passes

## Intentionally Parked / Deferred

### A) Real-table validation sweeps (deferred until after major product-development slices)

Still valuable, but intentionally not the active roadmap priority during this development phase:

- mixed DM/player/display handoff checks during active sessions
- refresh/rejoin/reconnect stability checks in longer sessions
- repeated rest/combat cycle persistence checks

### B) Supabase security/access-model hardening follow-up (deferred, not dismissed)

Already-landed first pass remains the baseline:

- RLS enabled on previously flagged public tables
- first-pass policies on `app_settings`, `alerts`, `profile_monster_spells`, `profile_player_spells`, and `spells`
- flagged functions hardened with explicit `search_path`
- `combatants_public` rebuilt as `security_invoker = true` with read-only (`SELECT`) grants

Deferred follow-up (resume after major product-development scope):

- app-aware table-by-table tightening (`combatants`, `player_encounter_state`, `concentration_checks`, `profile_player_spells`, `secret_rolls`, `combat_log`)
- selective narrowing review for `alerts`, `app_settings`, `profile_monster_spells`, and `spells`
- leaked-password protection remains unavailable on the current Supabase plan

Deferral principle:

- keep hardening app-path validated and staged, not blind policy sweeps that risk live-play breakage

### C) Other parked items

- broad visual retheme work outside real play-friction fixes
- large speculative redesigns of already-stable runtime surfaces
- non-critical shell polish that does not materially improve live-session reliability

## Longer-range Ideas (not active)

- additional world-facing quality-of-life features only after active roadmap tracks are materially progressed
- optional admin-surface polish that is not currently tied to verified table friction

## What A New Chat Should Do First

After reading workflow/docs and checking live repo state:

1. confirm current `main` tip, open PR state, and build/deploy health
2. verify any newly reported bug against current landed baseline before scoping work
3. prioritize active roadmap tracks above parked/deferred items unless risk dictates otherwise
4. keep completed baseline tracks closed unless a reproducible regression exists on current `main`

## Success Condition for This Brief

This roadmap is healthy when a new chat can quickly see:

- active next-step development tracks
- intentionally parked/deferred work
- longer-range optional ideas that are not current implementation scope
- clear separation between landed baseline and true open roadmap work
