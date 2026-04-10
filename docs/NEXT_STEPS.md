# DM Dashboard — Next Steps Brief

Last updated: April 10, 2026

Purpose: This file is the active roadmap only. It should list genuinely open work, intentionally parked work, and clearly labeled future planning ideas that are not active implementation.

## Source-of-truth order

1. Live GitHub repo
2. This Next Steps Brief
3. Project Brief for background/current-state context

If this document conflicts with the live repo, the live repo wins.

## Current Position

As of main at commit `672e3f0` (April 10, 2026), the following tracks are treated as landed baseline, not active roadmap tracks:

- initiative/player-card compacting and combat presentation stabilization
- long-rest + spell-preparation runtime flow
- spell/runtime workflow baseline and related management surfaces
- world-map display control mode
- monster/NPC archive management
- build/version marker and display verification baseline behavior
- tab/focus artifact cleanup in the DM shell

This roadmap stays intentionally lean and should not reopen those tracks without a verified current regression on `main`.

## Open Work

### 1) Real-table validation sweeps (ongoing)

Run targeted regression sweeps against current baseline behavior:

- mixed DM/player/display handoff checks during active sessions
- refresh/rejoin/reconnect stability checks in longer sessions
- repeated rest/combat cycle checks for persistence and runtime-state integrity

## Intentionally Parked

- broad visual retheme work outside real play-friction fixes
- large speculative redesigns of already-stable runtime surfaces
- non-critical shell polish that does not improve live-session reliability

## Future Planning (not active implementation)

### Optional world-map enhancements (future)

Potential quality-of-life additions if real table usage justifies them:

- richer map source/preset handling beyond a single saved URL
- recurring scene presets for faster session transitions
- low-risk interaction polish only when usage data shows friction

### Optional archive/management-surface enhancements (future)

Potential quality-of-life follow-ups if usage proves need:

- large-library filtering/search polish for Monsters & NPCs
- low-risk management UX polish in repeated admin workflows

### Future planning track — Inventory / Equipment / Abilities (planning only)

Status: planning-only direction. This is **not** active implementation scope in this batch.

Feasibility framing:

- a basic inventory system is very feasible
- a fully rules-aware inventory/equipment/attunement/stat-modifier engine is feasible but medium-to-high risk
- a separate abilities/boons system is feasible, but should not become a duplicate “resource system 2”

#### Phase 1 — safe inventory baseline

- player inventories managed by DM and player
- currency tracking
- mundane items
- supplies / consumables
- magical items as tracked records
- quantity and notes
- no automatic stat effects yet
- no equipment/attunement math yet

#### Phase 2 — equipment / attunement state

- equipped / unequipped state
- attuned / unattuned state
- item categories (armor / weapon / shield / wondrous)
- still primarily state tracking
- still no broad automatic derived-math rewrites unless architecture is explicitly ready

#### Phase 3 — shared mechanical effect engine (high-risk phase)

Proceed only through one shared modifier pipeline (no per-component math patches).

Potential future influence areas:

- AC
- saves
- stats
- spell DC / spell attack
- initiative
- related derived values

This phase is explicitly risky and should not be implemented through scattered UI-level hacks.

#### Separate planned sibling track — abilities / boons

- descriptive or passive abilities that are not limited-use resources
- class/background/species/feat boons
- modeled as a sibling system, not “resources again”
- can eventually feed shared modifier logic only if/when a unified effect engine exists
- should start as descriptive/tracked first, not full rules automation

#### Explicit cautions for any future implementation

- do not attempt inventory + attunement + full mechanical effects + abilities in one leap
- preserve profile-first durable setup with encounter-state runtime overlay
- if implementation starts later, it must be phased
- centralize shared rules/modifier logic; do not duplicate it across surfaces

## What A New Chat Should Do First

After reading workflow/docs and checking live repo state:

1. confirm `main` tip, open PR state, and latest build/deploy health
2. verify any newly reported bug against the current landed baseline before scoping work
3. prioritize concrete regressions and live-table friction over speculative redesign
4. keep completed baseline tracks closed unless a reproducible current issue exists

## Success Condition for This Brief

This roadmap is healthy when a new chat can quickly see:

- what is truly still open (very little, mostly validation)
- what is intentionally parked
- what is future planning only (including phased inventory/abilities planning)
- what should not be reopened without verified regressions on current `main`
