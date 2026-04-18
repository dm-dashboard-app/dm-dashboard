# DM Dashboard — Next Steps Brief

Last updated: April 18, 2026 (targeted still-unpriced pricing completion pass landed)

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

### 1) Equipment + Attunement + Import Enrichment (Phase 1 baseline; active)

Goal: deliver the first fully playable equipment/attunement baseline by preserving the existing durable item trail, expanding item-definition imports so real mechanics can be represented, and proving the full trail through real stat influence (not just flags).

Current landed baseline to preserve (already true on `main`):

- `item_master` is the canonical reusable item-definition layer.
- world/locale/shop inventory rows already reference `item_master` identity.
- inventory rows are already the owned-item durable layer for player possession.
- short rest already runs as a player-response + DM-confirm procedure with encounter-level active markers.
- long rest already has a preparation flow.

Phase 1 work now being scoped in detail (not yet landed):

Recent landing note (April 17, 2026 follow-up polish/fix batch): mobile inventory tab density, short-rest active-button fit, AC/custom-AC profile visibility, and structured item mechanics detail display were tightened without changing the Phase 1 architecture boundaries.
Recent landing note (April 17, 2026 source-split item conversion batch): curated `resources/items_by_source/*.json` inputs now have a deterministic converter + generated app-shaped seed artifact + in-app Manage → Imports action, without changing runtime `item_master` trust boundaries.
Recent landing note (April 17, 2026 manifest truthfulness follow-up): `resources/items_by_source/manifest.json` now reflects only surviving curated in-repo source files and current totals; converter/generator now treat this manifest as the required truthful source index (no silent missing-file skips).
Recent landing note (April 17, 2026 5etools import review/export panel): Manage → Imports now exposes a DM-side live `item_master` review surface for the 5etools source-split lane (counts by eligibility/type/mechanics/pricing, plus copy/export JSON), so post-import validation no longer requires ad hoc DB inspection.
Recent landing note (April 17, 2026 5etools pricing enrichment): converter output now reuses the existing curated `shop_magic_pricing_2014` overlay, includes plus-order alias matching for common naming variants, and applies a constrained fallback policy with explicit provenance (`5etools_fallback_policy_v1`) when raw value and overlay match are both unavailable.
Recent landing note (April 17, 2026 5etools completion reporting scaffold): Manage → Imports now also exports a structured JSON review report (pricing source splits, unresolved/unpriced, overlay-excluded, shop-eligible/non-shop, mechanics-support + structured/null mechanics + attunement + Phase-1-compatible payload slices) so follow-up completion work can be driven from copy/paste data instead of screenshot/manual interpretation.
Recent landing note (April 17, 2026 attunement/runtime truth fix): 5etools converter + report logic now promote attunement truth into runtime fields from direct/nested/raw attunement signals, and Phase 1 compatibility reporting now requires runtime-meaningful attunement/mechanics consistency (not structured payload presence alone).
Recent landing note (April 17, 2026 mechanics family batch 1): converter mechanics derivation now promotes simple passive equip/attunement families (ability-score setters/bonuses, AC/saves passives, shield-specific AC handling, and passive spell attack/save bonuses) into truthful `phase1_supported` payloads when they map cleanly to existing runtime semantics.
Recent landing note (April 17, 2026 shop-admission tightening): the 5etools converter now applies `5etools_shop_admission_v2` category-family policy so gem/art/coin/trade-good/ship-airship/large-vehicle clutter is excluded from the active import artifact, while poison/explosive rows are kept but hard-demoted to non-shop (`hazardous_non_default`) with explicit catalog-admission metadata and structured report visibility.
Recent landing note (April 17, 2026 5etools stale-row runtime exclusion fix): the import RPC now uses a dedicated `five_tools_2014` mode and actively demotes stale previously-imported 5etools rows that are no longer present in the generated active-lane artifact, but only after server-side payload safety checks validate source-layer metadata and exact expected active-row count parity.
Recent landing note (April 17, 2026 5etools pricing match-coverage + triage pass): converter pricing now extends high-confidence fallback coverage for plus-tier enhancement magic-item families, spell-scroll levels, and spellwrought tattoo levels (all with explicit fallback provenance + non-default shop posture), while the live review report now splits unresolved rows into overlay/match-miss candidates vs intentionally excluded/noise vs true manual residue.
Recent landing note (April 17, 2026 shop-surface trust-boundary + curated fallback matrix pass): shop generation now hard-gates candidate pools by final admission truth per shop surface (bucket/eligibility/manual-bucket exclusion + magic-shop affluence rarity/value guardrails), preserving scrolls as intentional magic-shop stock while preventing cross-surface leakage; converter pricing fallback now includes explicit manual-only override policy for campaign-warping manual/tome families plus expanded alias normalization for tiny overlay match-miss cleanup.
Recent landing note (April 17, 2026 5etools completion batch): converter fallback now adds a durable curated family pricing matrix + explicit outlier/manual policy for high-repeat unresolved families (essence shards, absorbing tattoos, dragon vessel/focus tiers), mechanics derivation now includes safe named +N weapon/armor/shield support and explicit dragon-touched focus/scaled ornament tier passive mappings, and regenerated active-lane metrics moved to: fallback priced 180, unresolved true manual review 164, structured mechanics 243, Phase-1-compatible payload 243.
Recent landing note (April 17, 2026 SRD lane replacement readiness gate): Manage → Imports now labels SRD refresh as legacy/deprecated while keeping it available as a fallback control; practical replacement target is met for the 5etools lane with an explicit remaining manual residue list (campaign-warping artifacts/deck-card families and bespoke one-off effects).
Recent landing note (April 18, 2026 manual-magic policy split + import UI cleanup): manual magic handling now uses final policy buckets (`manual_only_forever`, `curated_magic_nondefault`, `curated_magic_shop_stock`, `still_unpriced_but_priceable`) so `manual_magic_review` no longer acts as a large mixed holding bucket, and Manage → Imports now removes legacy SRD/custom controls + SRD failure/degraded panels in favor of a single full-width **Import Items** action plus retained imported-item review reporting.
Recent landing note (April 18, 2026 equipment/attunement/rest truthfulness polish): inventory buckets now resolve to non-overlapping Items (not equipped + not attuned) / Equipment (equipped + not attuned) / Attuned (attuned), short-rest and long-rest player flows now expose explicit attunement UX with max-3 guardrails, short-rest log rendering now emits readable procedure/response text, and profile manual AC/spell-attack bonus fields now normalize legacy persisted values into visible editor state.
Recent landing note (April 18, 2026 generalized attuned-gear activation + containment polish): slot-bound attunement-required gear now activates through attuned slot occupancy semantics (without reintroducing player-facing auto-equip confusion), inventory detail actions now block player direct-equip for attunement-required rows while allowing DM overrides/force-attune outside rest, long item detail + spell/rest list surfaces now use contained mobile scroll regions, rewards catalog browsing now supports incremental load-more scaling beyond the prior early cap, player top tab now labels with character name (ellipsis-safe), player NPC portraits now lazy-load with lightweight placeholder behavior, and short-rest log output now suppresses low-value duplicate/no-signal noise.

Recent landing note (April 18, 2026 items-base upstream restoration pass): source-split generation now reads `resources/items_by_source/items-base.json` as a declared supplemental upstream input with stable source+name identity dedupe against curated rows, restoring omitted baseline PHB/SRD combat equipment rows (for example Dagger, Longsword, Leather Armor, Shield) into the active generated artifact without re-running a full monolith re-split.

Recent landing note (April 18, 2026 canonical plus-family generation + inventory crash fix): player inventory open-path now tolerates malformed/null snapshot rows without render-crashing, and source-split conversion now deterministically generates canonical ordinary +1/+2/+3 weapon/armor/shield families from trusted PHB mundane base rows while explicitly excluding ammunition/non-table weapon semantics (no broad magical-variants monolith intake), with clear generated provenance metadata and regenerated artifacts.
Recent landing note (April 18, 2026 targeted still-unpriced pricing completion pass): the converter now applies curated family pricing for the previous 97-row `still_unpriced_but_priceable` residue (for example ring-of-resistance, scroll-of-protection, figurine/carpet/horn families, TCE/BMT named clusters, and selected named outliers), moves deck-chaos/high-swing outliers to `manual_only_forever`, and keeps priced residue explicit nondefault unless genuinely safe for shop stock. Regenerated counts now show `still_unpriced_but_priceable: 0`, `manual_only_forever: 71`, `curated_magic_nondefault: 197`, `curated_magic_shop_stock: 76`, `unresolved_unpriced: 92`, and `shop_eligible: 445`.
Recent landing note (April 18, 2026 inventory/import/mobile follow-up): inventory snapshot normalization now coerces malformed row field-shapes to safe render primitives (preventing player-view inventory black-screen regressions from invalid row payloads), the 5etools import lane now sends aggregate active-lane import meta for curated + generated canonical enhancement rows (and matching RPC validation accepts this strict two-layer set while preserving expected-row safety parity), and Manage → Imports now uses a mobile-first stacked report layout with compact summary cards plus a controlled show/hide expansion for the giant imported-row list.
Recent landing note (April 18, 2026 item-mechanics null-guard crash fix): inventory render-time item-effect helpers now normalize malformed/null selected-item and metadata mechanics shapes before attunement/equipment classification, preventing player inventory open-path black-screen crashes from null mechanics reads while preserving existing equip/attunement semantics.
Recent landing note (April 18, 2026 AC fallback baseline correction): derived AC fallback no longer trusts legacy `profiles_players.ac` values; when no active armor formula applies, baseline AC is now automatic (`10 + DEX mod`), with explicit armor formulas still taking priority over Mage Armour, Mage Armour still applying when no armor formula is active, and manual `ac_bonus` plus shield/flat item layering preserved.
Recent landing note (April 18, 2026 curated mundane armor/shield mechanics wiring): source-split conversion now emits phase-1 mechanics payloads for baseline PHB mundane armor/shield rows (including Leather/Studded Leather/Chain Shirt/Breastplate/Half Plate/Chain Mail/Splint/Plate/Shield) by deriving armor formulas and shield bonuses directly from trusted item shape fields (`type` + `ac`), so curated-lane imports no longer strand these rows in `manual_required`.
Recent landing note (April 18, 2026 combat AC inventory-context parity + attunement-only semantics fix): initiative/combat cards now derive AC/spell stats through `buildDerivedPlayerStats(...)` with live inventory snapshots (matching player-card armor/shield layering), and source-split conversion now emits attunement-required minimal mechanics payloads for inventory-slot rows (for example Pearl of Power / dragon vessel tiers) so runtime no longer degrades those items into equip-only semantics.
Recent landing note (April 18, 2026 NPC portrait list-load polish): World → NPC list rows now keep portrait slots visually stable with shimmer skeleton overlays, prioritize above-the-fold portrait fetches, avoid hiding portrait images until late `onLoad`, and gracefully fall back to `No portrait` on broken image URLs so list text no longer feels stalled while portraits resolve.


#### A) Durable item trail and source-of-truth model (required)

- Preserve this durable provenance chain end-to-end: **shop/locales/world shop -> owned inventory item -> equipped/attuned state -> stat influence**.
- Keep `item_master` as canonical reusable item definitions.
- Keep owned inventory rows as durable player-owned item instances.
- Do not create a disconnected parallel equipment store that breaks provenance from acquisition source.

#### B) Import/data-enrichment lane is first-class scope (required)

This is part of the same equipment/attunement track, not an optional side note.

- Extend import/custom-seed lanes so item definitions can be enriched in one repeatable pass with minimal manual cleanup.
- Enriched item-definition model must support:
  - equip slot / activation mode
  - attunement requirement
  - armor formulas
  - passive effect payloads
  - charges / recharge metadata
- Make this reliable and re-runnable as an import/update lane, explicitly avoiding hand-maintained patchwork that repeats prior import pain.
- Reason for inclusion: equipment/attunement implementation is not useful unless item definitions can actually express mechanical behavior.

#### C) Player-facing organization model (Items / Equipment / Attunement)

- Evolve player inventory UX into three functional views: **Items**, **Equipment**, **Attunement**.
- Do not duplicate the same owned item across containers.
- Each owned item should sit in one functional state/container at a time instead of appearing redundantly in multiple lists.
- Attunement-focused views must surface relevant attunement candidates directly and avoid forcing players through giant undifferentiated inventories.

#### D) Phase 1 equipment slot model (explicit)

- armor: 1
- shield: 1
- main hand: 1
- off hand: 1
- neck: 1
- rings: unlimited
- wondrous/no-visible-slot items may activate through attunement without inventing fake visible wear slots.

Phase 1 weapon handling is intentionally limited to main hand + off hand only. Wider weapon nuance (for example two-handed/versatile restrictions) stays out of this phase.

#### E) Equip / unequip / attune / unattune rules (explicit)

- Players can equip at any time.
- Players can unequip at any time.
- Players can unattune at any time.
- Players can attune only during short rest or long rest.
- Equipping into an occupied slot must prompt for confirmation; confirm auto-unequips the old item, cancel keeps current state.
- Unequipping an attuned item auto-unattunes it.

#### F) Activation gates (explicit)

- Non-attunement items with passive effects: **equipped = active**.
- Attunement-required items: **equipped + attuned = active**.
- Wondrous items without visible equipment slots: **attuned = active**.
- Unattuning or unequipping removes active effects as appropriate.

#### G) Rest integration points (explicit)

- Short rest must gain an attunement section inside the existing player-response / DM-confirm procedure.
- Long rest must gain an attunement section inside the existing preparation flow.
- Long rest must also gain charge-recharge entry for applicable items.
- Phase 1 recharge handling is table-scoped to long rest only.
- Rest attunement views should show:
  - currently attuned items first
  - eligible unattuned attunement items from bag/inventory below
  - no giant unfiltered inventory dumps

#### H) Charges / recharge model (Phase 1)

- Charges live on the owned inventory item instance (durable item-instance state), not only encounter-runtime overlays.
- During long rest, player enters restored charges for items that recharge at dawn/long-rest cadence.
- System enforces max-charge caps.
- Recharge entry still applies where rules allow recharge independent of current attuned state.

#### I) Armor/stat influence baseline that must be proven in Phase 1

Phase 1 is not complete if it only stores equipment/attunement flags. It must prove full trail into real derived outcomes.

Minimum Phase 1 influence targets:

- armor-specific AC formulas per item
- shield AC bonuses
- flat AC bonuses
- simple passive stat effects where practical
- spell save DC bonuses
- spell attack bonuses
- saving throw bonuses
- ability score bonuses where practical

Armor handling must allow per-item AC behavior/formula and must not collapse to one blanket light/medium/heavy shortcut.

#### J) Manual profile bonus boxes stay in place (explicit preservation)

Moving AC and other derived effects toward item/ability-driven calculation must **not** remove existing manual profile bonus boxes / manual-override-style additions.

- Keep manual profile bonuses for AC and other existing derived bonus fields.
- Manual overrides remain necessary for story/adjudication edge cases outside item/ability automation.
- Item/effect automation must layer with and respect manual profile bonuses rather than replacing operator override capability.

#### K) Shared future effect hook (items + attunement + abilities/boons)

Phase 1 must leave a clean hook point for future player abilities/boons/features that also modify stats.

- Do not build equipment effects as an isolated bespoke math path.
- Design toward one shared modifier path that can later accept:
  - item effects
  - attunement-gated item effects
  - player ability/boon/feature effects
- The broader shared mechanical effect engine remains a later/higher-risk phase, but Phase 1 must avoid painting the repo into a corner.

#### L) Scope truthfulness guardrail

This section is active roadmap scope and direction. It is not yet landed implementation.

### 2) Spell architecture follow-up — subclass-granted spell modeling

Goal: close known modeling gaps for subclass spell access while preserving current role/runtime correctness.

- represent subclass-granted off-list spells distinctly from ordinary learned/prepared rows
- support always-prepared subclass spells without consuming ordinary prep slots
- avoid fragile per-view exceptions across DM/player/runtime spell surfaces

### 3) Conservative code-health batches (after product track slices)

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


### Equipment enrichment follow-up (post-Phase-1 truthfulness)

Execution artifact: use `docs/5ETOOLS_IMPORT_COMPLETION_PLAN.md` as the canonical completion-plan breakdown for pricing truthfulness + shop admission tightening + mechanics family rollout.

- Expand mechanics enrichment coverage from current `phase1_supported` curated set toward broader SRD item coverage without overclaiming unsupported rows.
- Keep unsupported/non-enriched items explicitly manual until represented with truthful structured mechanics.
- Follow-up shop generator tuning: concrete enhanced armor/weapon/shield variants currently exist only in a future-prep catalog state (not live shop-eligible / not `phase1_supported`). A later focused pass must decide exactly which subset becomes live for higher-affluence blacksmith and magic-shop generation.
