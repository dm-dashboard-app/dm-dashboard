# DM Dashboard — Next Steps Brief

Last updated: April 13, 2026 (shop import operator correction landed)

Purpose: This file is the active roadmap only. It should list genuinely open work, intentionally parked work, and clearly labeled future planning ideas that are not active implementation.

## Source-of-truth order

1. Live GitHub repo
2. This Next Steps Brief
3. Project Brief for background/current-state context

If this document conflicts with the live repo, the live repo wins.

## Current Position

As of main at commit `e6eb6aa` (April 13, 2026), the following tracks are treated as landed baseline, not active roadmap tracks:

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

This roadmap stays intentionally lean and should not reopen those tracks without a verified current regression on `main`.

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

### DM World tab shop inventory generator + durable magic pricing overlay (2014-only, phased track)

Status: **active phased track with Stages 1-2 landed**. Later phases remain open and intentionally scoped.

#### 1) Product framing

- DM-only utility for worldbuilding and session operations; not player-facing commerce in v1.
- Separate from player inventory/equipment implementation for now.
- Intended to generate usable shop stock quickly during prep or live play.
- Architected as a reusable foundation for future inventory/equipment/world systems.
- Stage 1 foundation scope is now implemented; remaining scope is phased follow-up (generator UI, save flows, and later systems).
- This plan should be treated as a candidate post-session implementation batch once live table timing allows.

#### 2) Placement / navigation plan

- Current live repo baseline does **not** yet include a World tab in the DM shell.
- This feature would add a genuinely new DM-side tab/surface.
- Recommended placement: future main DM tabs → **World**.
- Inside World, initial sub-surface can be **Shops**.
- Preserve strict DM/player/display role separation.
- Any future World tab remains DM-only unless explicitly expanded later.

#### 3) V1 feature scope

V1 should include:

- Generate a shop from `shop_type + affluence_tier` input.
- Auto-generate stock rows with explicit quantity.
- Show: item name, quantity, listed price, minimum barter price, barter DC.
- Item rows are tap/clickable to open details/descriptions.
- Save generated shops for reuse.
- Allow regenerate/re-roll behavior for stock generation.
- Support lower stock counts for magic-focused shops.
- Support shop records without requiring shopkeeper identity or flavor fields.

V1 intentionally out of scope:

- Player-facing buying UI.
- Purchase transaction resolution.
- Automatic gold deduction.
- Inventory assignment/equipment effects.
- City-level business simulation.
- Shop owner/NPC generation.
- Non-DM access.
- 2024 rules support.

#### 4) Data model plan (planning targets; separation requirement is non-negotiable)

Planning note: field names may refine during implementation, but item-master separation from shops is mandatory.

**A. Reusable item master entity** (durable shared catalog)

Recommended planning fields:

- `id`
- `name`
- `slug`
- `item_type`
- `category`
- `subcategory`
- `rarity`
- `requires_attunement`
- `description`
- `rules_text_json` (or equivalent structured details)
- `base_price_gp`
- `suggested_price_gp`
- `price_source`
- `source_type`
- `source_book`
- `source_slug`
- `rules_era`
- `is_shop_eligible`
- `shop_bucket`
- `metadata_json` (or equivalent extensible structured fields)

**B. Shop entity** (saved shop record independent of stock rows)

Recommended planning fields:

- `id`
- `shop_type`
- `affluence_tier`
- `district_label` or `district_type` (future)
- `saved_name` (nullable/optional)
- `generation_seed`
- `locked` (boolean)
- `generated_at`
- `updated_at`
- `notes` (optional)
- nullable future city-linkage field for expansion

**C. Shop inventory join entity** (generated stock rows)

Recommended planning fields:

- `id`
- `shop_id`
- `item_id`
- `quantity`
- `listed_price_gp`
- `minimum_price_gp`
- `barter_dc`
- `is_featured` (optional)
- `stock_notes` (optional)
- `sort_order` (optional)

**D. Import/source metadata expectations**

Every imported item should carry:

- explicit 2014-era marker for strict filtering
- source-family marker (e.g., SRD / custom seed / homebrew / licensed)
- stable slug or equivalent dedupe key
- rerunnable-import compatibility

Critical architecture decision (must be preserved):

- Items are a standalone reusable entity.
- Shops reference items through generated join rows.
- Do **not** embed item definitions directly inside shop records.
- This is the required future-proofing path for later inventory/equipment/world reuse.

#### 5) Import strategy plan (detailed)

Target import architecture: controlled, rerunnable admin/import flow (similar in spirit to spell import), not live scraping at generation time.

One-action path is now landed in-app on the DM World → Shops surface via explicit import controls (SRD baseline refresh and custom-seed import).

Underlying behavior requirements:

- normalize external/source data into app-owned item tables
- safe upsert by stable identity keys
- rerunnable with no duplicate catalog spam
- preserve manual/custom curated items

**Lane A — 2014 SRD / Basic Rules compatible baseline import**

- baseline for mundane items and SRD-safe content
- intended to provide item names, descriptions/details, categories, and prices where available
- must be filtered strictly to 2014-compatible sources
- must not mix in 2024/alternate rulesets

**Lane B — magical item pricing overlay**

- Source PDF (`docs/Sane_Magical_Prices.pdf`) is planning/input source only.
- Durable overlay artifact is now `docs/data/shop_magic_pricing_2014.json`.
- Future system must use JSON overlay artifact, **not** direct PDF dependency.
- PDF should be treated as one-time curation source/archive reference.
- Overlay should populate/override suggested magic pricing by normalized-name match.
- Overlay can also provide practical shop-bucket grouping support.
- Source explicitly frames prices as a relative-economy tool, not absolute law.
- Items marked excluded/unpriced should default to non-shop stock or manual curation.
- Overlay remains implementation-time curated/tunable.

**Lane C — custom/homebrew/private seed import**

- controlled import lane for non-SRD/homebrew/private item content
- automated through same controlled import flow (not forced one-by-one runtime entry)
- explicit source markers required
- inclusion in generation pools only when marked shop-eligible
- do not assume blanket bulk import rights for all non-SRD official text
- private/custom seed is the safe default beyond SRD baseline absent explicit licensing

Recommended combined design:

- SRD/base content for item definitions
- `docs/data/shop_magic_pricing_2014.json` for magic-price overlay
- custom/private seed for non-SRD/homebrew additions

Legal/practical guardrail:

- do not assume all non-SRD 2014 official text can be mass imported as reusable app content
- keep implementation grounded in SRD-compatible sources plus custom/private seed lanes
- avoid dependence on questionable mass scraping

#### 6) 2014-only rules policy

- Feature policy is 2014 rules only.
- Imported items must carry `rules_era` (or equivalent marker).
- Generation must filter strictly to 2014-compatible records.
- Do not mix 2024 items, alternate systems, or A5E-like sources.
- Import pipelines must explicitly allowlist source sets; never assume public APIs are safe by default.

#### 7) Pricing strategy plan

Core pricing behavior:

- mundane items generally use imported base prices where available
- magical items use curated suggested-price layer
- current planning basis for magic layer: `docs/data/shop_magic_pricing_2014.json`
- listed price, minimum barter price, and barter DC are distinct generated outputs
- affluence + shop type influence listed price and bargaining difficulty
- magic shops should have smaller curated stock and stricter pricing behavior than mundane shops
- do not assume official 2014 material provides one universal magic-shop price table

Planned stored price fields:

- `base_price_gp` = source/default value
- `suggested_price_gp` = catalog recommendation (especially magic)
- `listed_price_gp` = generated offered shop price
- `minimum_price_gp` = negotiation floor
- `barter_dc` = negotiation difficulty target

#### 8) Generation logic plan

Generation should use weighted pools, not flat random draws.

Weighting inputs:

- shop type
- affluence tier
- magic eligibility
- rarity/category
- shop bucket
- optional district flavor (future)

Recommended behavior by type:

- blacksmith → weapons/armor/shields/metal tools/ammo/repair-adjacent goods
- general store → mundane adventuring gear/travel utility/common consumables
- apothecary/alchemy → consumables + specialty utility
- magic shop → eligible magic pool, fewer rows, higher/stricter pricing
- poor/modest → cheaper/common stock bias
- wealthy → higher-value/broader high-rarity availability

Planning stock-count guidelines:

- general store: ~18–24
- blacksmith: ~12–18
- apothecary/specialty: ~10–16
- magic shop: ~6–10
- user-facing normal target remains “about 20” for non-magic shops

Additional generation controls:

- duplicate handling should be deliberate
- quantity is explicitly generated per row
- rare/gamechanging entries should be controlled/excluded by default
- certain items should be marked non-shop/manual-approval only

#### 9) UI/UX planning section (DM-only)

Recommended future World → Shops structure:

- top control row: shop type, affluence tier, generate
- save/regenerate controls
- generated stock list below

Per stock row display:

- item name
- quantity
- listed price
- minimum barter price
- barter DC
- tap/click opens details

Item detail panel/modal:

- description/details
- type/category
- rarity (if relevant)
- source marker (helpful for curation)
- optional base/suggested price visibility for DM decision support

V1 UX priorities:

- fast scan and in-session speed
- compact mobile-first presentation
- no low-value fluff fields
- no overbuilt merchant simulation

Design constraint:

- respect dense-information principle from current repo UX
- do not hide critical stock/pricing data behind avoidable extra clicks
- preserve mobile-first practicality

#### 10) Phased implementation plan

**Phase 1 — Foundation (landed on main)**

- ✅ reusable `item_master` schema SQL prepared with standalone reusable item entity
- ✅ controlled 2014-only SRD import lane implemented (`npm run import:items:2014`)
- ✅ source/rules metadata fields wired (`source_type`, `source_book`, `source_slug`, `rules_era`)
- ✅ rerunnable deduped upsert behavior via stable `external_key` conflict target
- ✅ durable magic-pricing overlay (`docs/data/shop_magic_pricing_2014.json`) consumed directly by import lane
- ✅ no World/shop UI added in this phase (intentionally deferred for scope control)

**Phase 2 — DM-only shop generator (landed on main)**

- ✅ added World tab DM-only surface in DM shell
- ✅ added shop type + affluence controls
- ✅ implemented weighted stock generation from `item_master`
- ✅ added save and regenerate flows for durable shops
- ✅ tightened DM-only persistence posture to server-mediated writes (RPC) for DM-only persistence tables
- ✅ current trust-boundary fit: DM uses Supabase-authenticated path; player/display remain local token/join-code flows
- ✅ added quantity/listed/minimum/barter DC rows
- ✅ added compact item detail modal
- ✅ kept implementation DM-only (no player/display shop surface)

**Phase 3 — Magic overlay + curation (landed on main)**

- ✅ overlay-driven curation integrated into shop generation logic from `docs/data/shop_magic_pricing_2014.json` fields imported into `item_master`
- ✅ explicit excluded/manual/unpriced/gamechanging/special suppression tightened for default generation paths
- ✅ magic-shop pool narrowed with lower per-shop row counts, curated bucket weighting, and reduced duplicate churn
- ✅ rarity weighting tuned specifically for magic contexts with stronger poor/modest suppression on high-rarity stock
- ✅ affluence-sensitive magic availability made more deliberate while preserving Stage 2 save/regenerate flows

**Phase 4 — Custom/homebrew/private import lane (landed on main)**

- ✅ added in-app DM/admin import controls in World → Shops for one-action baseline (`Refresh 2014 SRD Catalog`) and custom-seed (`Import Custom Seed`) workflows
- ✅ added server-mediated RPC path (`dm_import_item_master_rows`) so client no longer depends on service-role secrets or terminal scripts for normal shop import use
- ✅ kept explicit source markers (`source_type`, `source_book`, `source_slug`) plus `rules_era=2014` validation in the server import path
- ✅ corrected custom seed defaults: `docs/data/shop_custom_items_seed_2014.json` is now default-safe/empty and prior sample rows are moved to `docs/data/shop_custom_items_seed_2014.example.json` as example-only content

**Phase 5 — Expansion hooks (later)**

- city-shop linkage
- persistent world/city shop records
- inventory/equipment reuse of shared item catalog
- optional restock/regeneration policy layer
- optional transaction integration much later

#### 11) Explicit future linkage section

- City shop lists should later point to saved shop records.
- City entries can store type + affluence and generate inventory from those attributes.
- Saved generated stock should remain reusable independent records.
- Future inventory/equipment systems should read the same shared item master catalog.
- Do not build a one-off shop-only item model that must be replaced later.

#### 12) Constraints / risk notes

- Do not implement before current live session commitments complete.
- Stage 1 through Stage 3 are now implemented; later phases remain intentionally deferred.
- Do not risk runtime stability before the session window.
- Imports should be controlled + rerunnable; do not live-scrape during gameplay.
- Avoid legal/data-quality assumptions around non-SRD bulk text ingestion.
- Do not widen first implementation into full inventory/equipment automation.
- Preserve DM/player/display role separation.
- Keep 2014-only filtering explicit across import and generation.

#### 13) Planning recommendation / priority statement

This track now has a curated DM baseline through Stage 4. Remaining work should stay phased (starting with Stage 5 expansion hooks) and avoid widening into player transactions/inventory automation until explicitly scheduled.
