# DM Dashboard — Next Steps Brief

Last updated: April 16, 2026 (short-rest player visibility + DM cancel reliability fix landed)

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

### 1) Rest procedure architecture expansion — attunement section insertion (active)

Goal: extend the newly landed short-rest player-response/DM-confirm procedure shape with additional sections (starting with attunement) without regressing current healing/resource behavior.

- Keep short rest as a sectional player-response + DM-confirm procedure.
- Preserve newly landed short-rest reliability behavior:
  - player active-cycle detection should stay tied to encounter-level short-rest active markers (not player combat-log reads)
  - DM cancel should remain a true procedure cancel event that clears active-cycle state without applying rest effects
- Preserve landed short-rest healing response behavior:
  - player-entered rolled total + total hit dice + per-die-size spend accounting
  - shared Song of Rest source input and group application
  - concise DM review summary and confirm step
- Add attunement as the next section inside this shared rest procedure shape (not as a disconnected workflow).
- Keep mobile-first response and review ergonomics.

### 2) Shared rest-procedure architecture direction (active)

Goal: build practical reusable rest flow structure now so future rest work does not fork into isolated one-off forms.

- Implement short rest as a shared player-submission / DM-confirm procedure shape, not a one-off short-rest healing form.
- Keep short-rest response payloads sectional and future-extensible.
- Do not implement attunement in this batch, but structure the flow so attunement sections can plug in later.
- Keep healing inputs and hit-dice accounting separate from future equipment/attunement effect logic.
- Prioritize practical product flow reuse for short rest + long rest, not abstract architecture for its own sake.

### 3) Inventory / Equipment / Abilities — phased expansion track

Goal: continue from landed Inventory Phase 1 into phased character-capability expansion, with attunement explicitly planned inside shared rest procedures.

#### Phase 2 — equipment / attunement state + rest integration design

- add equipped / unequipped and attuned / unattuned state
- support practical item categories (armor / weapon / shield / wondrous)
- keep initial implementation state-driven (avoid broad derived-math rewrites in this phase)
- design attunement as a rest-embedded procedure, not a standalone unrelated workflow

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

### 4) Attunement inside rest procedures — upcoming design track (not yet in-flight)

Goal: lock the future product direction so attunement work lands coherently across rest flows.

- Attunement belongs inside rest procedures, not as a separate unrelated workflow.
- Attunement must later sit inside short rest.
- Attunement must also sit inside long rest.
- Long rest should use the same attunement procedure/UI pattern as short rest where practical.
- In long rest, attunement will live alongside spell preparation rather than replacing it.
- Shared rest-procedure UI/flow should be reused across short rest and long rest where practical.
- This is active roadmap/design direction, but it is not yet landed and not currently in-flight implementation.

### 5) Spell architecture follow-up — subclass-granted spell modeling

Goal: close known modeling gaps for subclass spell access while preserving current role/runtime correctness.

- represent subclass-granted off-list spells distinctly from ordinary learned/prepared rows
- support always-prepared subclass spells without consuming ordinary prep slots
- avoid fragile per-view exceptions across DM/player/runtime spell surfaces

### 6) Conservative code-health batches (after product track slices)

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

- additional optional quality-of-life features only after active roadmap tracks are materially progressed

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
