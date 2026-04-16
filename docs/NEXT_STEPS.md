# DM Dashboard — Next Steps Brief

Last updated: April 16, 2026 (Spell-slot compact grid + DM World tabs mobile fit + roadmap reconciliation)

Purpose: This file is the active roadmap only. It should list genuinely open work, intentionally parked work, and clearly labeled future planning ideas that are not active implementation.

## Source-of-truth order

1. Live GitHub repo
2. This Next Steps Brief
3. Project Brief for background/current-state context

If this document conflicts with the live repo, the live repo wins.

## Current Position

As of main at commit `97d2700` (April 16, 2026), the following tracks are treated as landed baseline, not active roadmap tracks:

- initiative/player-card compacting and combat presentation stabilization
- long-rest + spell-preparation runtime flow
- spell/runtime workflow baseline and related management surfaces
- world-map display control mode
- monster/NPC archive management
- build/version marker and display verification baseline behavior
- tab/focus artifact cleanup in the DM shell
- Stage 1 item-master foundation + controlled 2014 import lane (including durable magic pricing overlay wiring)
- Stage 2 DM-only World tab shop generator + saved shop stock
- Stage 3 magic overlay-driven curation tuning for DM world shops
- Stage 4 custom/homebrew/private lane + in-app DM import/refresh controls for item_master
- Inventory Phase 1 baseline (shared inventory UI, player self-edit, DM full edit, transfer lifecycle, DM-only audit log)
- Inventory workflow rebuild baseline (role-separated inventory sheets, DM World Rewards sub-tab, DM shop-row assignment/sell flow, DM currency award split tooling)
- Inventory follow-up baseline (quantity-aware item decrement/removal, player self-removal, narrow usable-item `Use 1` shortcut, hardened shop assignment feedback/loading + refresh behavior, and generated unsaved World Shop row assignment without requiring pre-save persistence)
- World tab expansion baseline: top-level Locales / Shop Generator / Rewards / NPCs, with durable locale records, district tracking, locale-bound shops + persisted inventory generation, and global NPC card/list/full-page editing flows

This roadmap stays intentionally lean and should not reopen those tracks without a verified current regression on `main`.

Latest landed follow-up (same World track):

- NPC portrait workflow now supports app-managed upload/replacement/removal (no raw external URL entry required for normal use)
- NPC list cards now include compact portrait thumbnails with clean fallback placeholders
- Player World access now includes read-only **Locales** and **NPCs** surfaces
- Player World keeps **Shop Generator** and **Rewards** excluded, and locale shop inventory stock rows remain DM-only

Code-health note:

- PR #109 was a conservative code-health audit pass.
- It landed only low-risk hygiene cleanup (unused imports and dead local helpers).
- It intentionally deferred risky structural cleanup into future isolated batches.

## Open Work

### 1) Real-table validation sweeps (ongoing)

Run targeted regression sweeps against current baseline behavior:

- mixed DM/player/display handoff checks during active sessions
- refresh/rejoin/reconnect stability checks in longer sessions
- repeated rest/combat cycle checks for persistence and runtime-state integrity


### 2) Supabase security/access-model hardening follow-up (future security debt; not outage)

Already completed in Supabase (first hardening pass):

- enabled RLS on previously flagged public tables
- added first-pass policies for `app_settings`, `alerts`, `profile_monster_spells`, `profile_player_spells`, and `spells`
- hardened flagged functions with explicit `search_path`
- rebuilt `combatants_public` as `security_invoker = true` and read-only (`SELECT` grants only)
- verified core app behavior still appeared to work after those changes

Intentionally deferred for app-aware follow-up (moderate security/access-model debt):

- table-by-table review/tightening priority order:
  1. `combatants`
  2. `player_encounter_state`
  3. `concentration_checks`
  4. `profile_player_spells`
  5. `secret_rolls`
  6. `combat_log`
- review whether `alerts`, `app_settings`, `profile_monster_spells`, and `spells` should be narrowed further beyond current first-pass safe policies
- leaked password protection remains unavailable on current Supabase plan and was therefore not enabled

Deferral reason:

- highest-risk exposure issues were reduced first
- remaining advisor yellows mostly reflect broad client-write access used by current live gameplay/runtime flows
- tightening blindly risks breakage; future hardening should be app-path inspected and validated, not a blind SQL sweep


## Intentionally Parked

- broad visual retheme work outside real play-friction fixes
- large speculative redesigns of already-stable runtime surfaces
- non-critical shell polish that does not improve live-session reliability

## Future Planning (not active implementation)

### Future planning track — Conservative code health follow-ups (preventive maintenance only)

These are not urgent blockers. They are isolated future cleanup batches intended to reduce maintenance risk without broad behavior changes.

1. **Legacy initiative path decision**
   - inspect and decide the fate of `src/components/InitiativePanel.js`
   - determine whether it should be deleted, archived, or rehabilitated
   - treat it as a risky legacy hotspot and only touch it in an isolated batch

2. **DMView monolith reduction**
   - `src/views/DMView.js` is structurally dense and high-friction for safe maintenance
   - future work should be a careful de-densify/extraction pass only
   - lock behavior first; do not mix broad functional changes into that batch

3. **Hook/dependency hygiene**
   - clean up existing hook-rule / `exhaustive-deps` issues in isolated batches
   - treat this as behavior-sensitive work, not automatic lint churn

4. **Compatibility stub / stale path review**
   - review placeholder/stub files such as `LoginScreen` and similar compatibility paths
   - remove only with explicit confirmation after verifying true non-use

### Optional world-map enhancements (future)

Potential quality-of-life additions if real table usage justifies them:

- richer map source/preset handling beyond a single saved URL
- recurring scene presets for faster session transitions
- low-risk interaction polish only when usage data shows friction

### Optional archive/management-surface enhancements (future)

Potential quality-of-life follow-ups if usage proves need:

- large-library filtering/search polish for Monsters & NPCs
- low-risk management UX polish in repeated admin workflows

### Future planning track — Inventory / Equipment / Abilities (post-Phase-1 planning)

Immediate follow-up note (still planning-only, not active scope):

- party funds support remains deferred by design and should be handled in a dedicated future batch after the rebuilt reward/shop flows settle in table use.

Status: planning-only direction. This is **not** active implementation scope in this batch.

Feasibility framing:

- a basic inventory system is very feasible
- a fully rules-aware inventory/equipment/attunement/stat-modifier engine is feasible but medium-to-high risk
- a separate abilities/boons system is feasible, but should not become a duplicate “resource system 2”

#### Phase 1 — safe inventory baseline

Status: landed on `main` as Inventory Phase 1 (inventory rows/currency/transfer workflows/audit log) and now closed as open roadmap work for this phase.

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

### Future planning track — Subclass-granted spell modeling (architecture)

Current gap to address in a future focused batch:

- some subclasses grant spells outside a class's normal spell list
- some subclass spells are always prepared and should not consume normal preparation slots

Required future architecture capabilities:

- model subclass-granted off-list spells distinctly from ordinary learned/prepared rows
- support always-prepared behavior without forcing fragile per-view exceptions
- preserve current spell-access correctness across runtime/player/DM spell surfaces

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
