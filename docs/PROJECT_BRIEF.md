# DM Dashboard — Project Brief

Last updated: April 18, 2026 (targeted still-unpriced pricing completion pass landed)

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
- short-rest now runs as a player-response/DM-confirm procedure: DM starts, players submit healing + hit-dice responses, DM reviews concise per-player totals, then confirms final application
- short-rest healing input now captures rolled total, total hit dice used, exact per-die-size spend breakdown, and one shared Song of Rest total from the eligible bard source
- short-rest active-state visibility now uses encounter-level active-cycle markers (`short_rest_active` + `short_rest_started_at`) so player prompts no longer depend on player combat-log reads
- DM short-rest modal now includes a true cancel action that writes a short-rest cancel procedure event and cleanly ends the active cycle without applying healing/resource changes
- short-rest completion still preserves short-rest resource restoration and round/log reset behavior
- spell-slot presentation now uses a compact mobile-first two-column layout for Levels 1–8 with Level 9 alone on the final row, with pact pips retained and the `PACT` text label removed
- player-card Bardic Inspiration pips now use a bard-specific music-note visual treatment (without changing spell-slot visuals or resource logic)

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
- non-magic shop inventory now builds in two internal lanes (Core Stock then Rotating Stock) while keeping one saved/rendered inventory list
- guaranteed non-magic core rows for apothecary/blacksmith/general store with affluence-aware core quantities
- affluence-sensitive pricing behavior across both core and rotating rows for non-magic shops (poorer somewhat cheaper, wealthier somewhat more expensive)
- lightweight one-list UI treatment: Core Stock / Rotating Stock labels plus subtle Core badge/highlight
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
- shop generator now enforces shop-surface trust boundaries against final item admission metadata: non-magic surfaces only admit their intended bucket families, manual/excluded buckets are hard-blocked, and magic-shop stock applies explicit affluence rarity/value guardrails before weighted selection
- intentional exception preserved: spell scroll families remain first-class magic-shop stock (core/rotating by level) without leaking into general-store/blacksmith pools

Preservation rule:

- keep default generation safe-by-default for special/problematic magic items while leaving manual curation to future explicit phases


### 13) Custom/homebrew/private import lane baseline (Stage 4)

Landed baseline includes:

- DM Manage → Imports now hosts explicit one-action import controls for baseline SRD refresh and custom-seed import
- DM Manage → Imports also hosts the SRD spell import control so import admin actions are centralized in one tab
- import writes now run through a server-mediated RPC (`dm_import_item_master_rows`) instead of requiring terminal-only scripts for normal operator workflow
- 5etools imports now use a dedicated RPC mode (`five_tools_2014`) so re-import can demote stale legacy 5etools rows that are no longer in the generated active artifact, with server-side payload safety guards requiring validated source-layer metadata and exact expected-row-count parity before stale demotion runs
- 5etools converter pricing now includes expanded high-confidence fallback coverage for unresolved plus-tier enhancement families (`+2/+3` style magic-item upgrades), higher spell-scroll levels, and spellwrought tattoo level variants, while keeping those fallback-priced rows explicit non-default stock unless separately curated
- 5etools fallback pricing now also carries a durable curated override policy for known campaign-warping manual/tome families (manual-only; no synthetic price) and expanded alias normalization for tiny overlay match-miss cleanup, preserving explicit unresolved provenance instead of over-broad generic auto-pricing
- 5etools review reporting now includes unresolved triage splits that separate likely overlay/match misses from intentionally excluded/noise rows and true manual unresolved residue (instead of one blurred unresolved bucket)
- 5etools fallback policy now includes a durable curated family matrix for high-repeat unresolved families (essence shards, absorbing tattoos, dragon vessel/focus tiers) while preserving explicit manual-only handling for campaign-warping/bespoke outliers
- manual-magic policy now uses explicit final buckets (`manual_only_forever`, `curated_magic_nondefault`, `curated_magic_shop_stock`, `still_unpriced_but_priceable`) so unresolved/manual residue is intentionally small and priced-but-nondefault rows are no longer mixed into a giant catch-all
- mechanics derivation now also supports safe name-derived +N weapon/armor/shield variants and explicit dragon-touched focus + scaled ornament tier passive mappings when they fit existing phase-1 runtime semantics
- SRD refresh now treats upstream detail fetch failures as transient run-time failures (reported in UI) and no longer persists new degraded fallback rows from those failures into `item_master`
- import RPC now hard-rejects degraded SRD payload rows (`degraded_import`, `degraded_fallback`, `fallback_quarantine`, `degraded_fallback_untrusted`) so client regressions cannot persist untrusted degraded SRD rows
- custom seed defaults are now explicit and safe: `docs/data/shop_custom_items_seed_2014.json` is intentionally empty-by-default, while prior sample rows live in `docs/data/shop_custom_items_seed_2014.example.json` as example/demo content
- Manage → Imports now presents one operator-facing item action (`Import Items`) and keeps the imported-item review/report tooling while removing obsolete SRD/custom import controls and old SRD failure/degraded status panels
- preserved generation safety: only `is_shop_eligible=true` and `rules_era=2014` rows can enter Stage 2/3 generation

Preservation rule:

- keep custom-content import controlled/reviewable in Git and avoid parallel shop-only item stores

### 14) Degraded SRD repair overlay + rehydration path baseline

Landed baseline includes:

- repair data comes from durable repo artifact `docs/data/shop_srd_degraded_repairs_2014.json` (served in-app from `public/data/shop_srd_degraded_repairs_2014.json`)
- degraded rows remain quarantined and excluded from shop generation by default
- SRD refresh now auto-reports the live degraded/quarantined SRD row set from current `item_master` rows immediately after import (no separate report-generation button)
- Manage → Imports now exposes that same live degraded/quarantined SRD row set directly as a readable row list with copy/export JSON actions for repair workflows
- degraded repair coverage now includes explicit per-item outcomes for the remaining target set in `docs/degraded-srd-item-master-rows.json` (78 rows): 51 rows repaired to trustworthy catalog shape and 27 rows marked `excluded_on_purpose` with explicit reasons (0 unresolved rows in that remaining target set)

Preservation rule:

- keep quarantine default-on for degraded SRD fallbacks and only clear it through explicit trustworthy repair data


### 15) Inventory subsystem baseline (Phase 1)

Landed truthfulness polish addendum (April 18, 2026):

- inventory rows now present in player-facing non-overlapping buckets by real state (`Items`, `Equipment`, `Attuned`) so attuned rows no longer disappear/misclassify
- inventory open-path now hardens snapshot row-shape assumptions so malformed/null rows no longer crash player inventory rendering to a black screen
- attunement RPC semantics no longer auto-force `equipped=true`, reducing player-facing equip/attune confusion while preserving activation rules
- player-facing long-rest path now includes direct inventory attunement/recharge access alongside spell prep readiness
- short-rest response + DM review path now preserves clearer attunement payload handling with improved combat-log readability
- manual profile bonus editor now normalizes persisted AC/spell-attack manual values into visible form fields (including legacy spell-attack storage variants)
- generalized attuned-gear activation semantics now treat slot-bound attunement-required items as active via attuned slot occupancy (without requiring misleading player-facing direct-equip toggles), while player inventory detail actions now present attune-first behavior for those rows and reserve direct-equip override/force-attune control for DM workflows
- mobile containment follow-up now caps and scroll-contains long item detail content plus spell/rest attunement list surfaces so large inventories/prose do not create runaway full-height panels
- DM rewards catalog now supports scalable load-more browsing beyond the previous small slice cap
- player top nav now labels the character tab with the actual character name (ellipsis-safe)
- player NPC list portrait loading now uses lazy-load + placeholder behavior to improve perceived performance on mobile
- short-rest response log output now suppresses low-signal duplicate/no-value entries while preserving meaningful procedure and readiness trail

Landed baseline includes:

- dedicated inventory subsystem tables + RPCs for player inventory items, currency, transfer lifecycle, and DM-only audit logs
- unified inventory surface across DM player cards, player runtime card, and Manage → Players rows
- compact inventory summary entry line format: `Inventory • {item quantity} items • {gp} gp`
- player self-edit path for own inventory/currency authorized via join-code + profile ownership server checks
- DM full edit path for any player inventory/currency and DM direct instant transfers
- player-to-player transfer request flow with receiver confirmation (accept/decline) and acceptance-time validation
- failure-safe transfer completion behavior (no partial applies on insufficient sender resources)
- incoming transfer popup support in player runtime independent of inventory modal open state

Preservation rule:

- keep inventory permissions isolated to inventory-specific server RPC authorization and do not broaden general profile write access



### 16) Inventory/rewards/shop assignment rebuild baseline

Landed baseline includes:

- role-aware inventory modal behavior: player surface is list/detail/transfer focused while DM surface keeps direct management controls without modal overload
- top-level inventory transfer in the main sheet is currency-only; item transfer launches from item detail modal only
- player currency display is read-only but now intentionally styled as a balanced four-denomination row with a full-width currency-transfer action bar (no direct player currency-total edits)
- DM inventory still supports direct item grants, direct inventory/currency management, and DM audit-log access in a cleaner layout
- DM World tab now has sub-tabs with separate **Shops** and **Rewards** surfaces
- Rewards surface is DM-only and supports item search/assign plus currency award to one player or all active players in current session, with explicit success/error feedback and inventory refresh on success
- inventory item upsert merge paths now correctly target the non-null item identity uniqueness condition (`item_master_id is not null`) so DM rewards, shop assignment, and linked item transfers do not fail on ON CONFLICT mismatch
- all-active currency split is deterministic: base equal split with remainder distributed one-by-one in ascending player-profile UUID order
- shop rows now support direct assign/sell-to-player flow with listed/minimum/custom pricing and atomic GP deduction + inventory upsert server operation, including generated unsaved rows (no forced pre-save step)
- inventory item detail now supports quantity-aware decrement/removal for both DM and player self-removal paths (including full-stack removal when quantity reaches zero)
- inventory item detail now provides a narrow `Use 1` shortcut for clearly consumable/usable rows (for example potions/rations/torches/ammo-like naming) without widening to a full rules engine
- world shop item-detail assignment flow now has explicit loading state plus success/failure feedback and post-success world/shop refresh behavior
- SQL source-of-truth now reflects the live `inventory_get_summary()` qualified-column ambiguity hotfix in repo SQL

Preservation rule:

- keep item identity anchored to shared `item_master` and keep DM-vs-player transfer confirmation boundaries role-correct

## Architectural / Product Principles for Future Work

- mobile-first practicality for real table use
- session stability over clever but fragile rewrites
- shared rules/modifier logic over duplicated component-local hacks
- profile-first durable setup with encounter-state runtime overlay
- preserve DM/player/display role boundaries and RLS-sensitive behavior

## Future-facing note

Inventory/equipment/abilities beyond Phase 1 is now the primary active development track in the roadmap, with phased delivery and shared modifier-logic architecture requirements documented in `docs/NEXT_STEPS.md`.

Real-table validation sweeps and Supabase security/access-model hardening follow-up remain intentionally deferred until after major product-development slices.

### 17) World locales + district/shop persistence baseline

Landed baseline includes:

- World top-level tabs expanded to **Locales / Shop Generator / Rewards / NPCs** and tuned to fit a single clean mobile row without overflow/overlap
- Locales list/detail mobile-first flow with focused create/edit sheets instead of giant always-edit forms
- locale overview model now includes politics/leadership, purpose, structure, notable features, hidden notes, and free notes
- district tracking inside locales with durable district records and notable-location notes
- locale-bound durable shop records (district-linkable) with full detail + inventory + notes sub-tabs
- locale shop inventory now supports persisted first-generation stock and explicit regenerate behavior

Preservation rule:

- keep locales as durable world records and keep locale shops distinct from ad hoc Shop Generator utility flows

### 18) World NPC library baseline

Landed baseline includes:

- standalone global NPC World tab (not nested under locales)
- mobile searchable NPC list cards
- full-page NPC detail card with portrait rail/top block behavior on phone
- simple baseline NPC model (`name`, `race`, `portrait_url`, `body_text`) with saved display + explicit edit flow

Preservation rule:

- keep NPC baseline lightweight/card-first and avoid overfitting early into full structured schema complexity

### 19) World player read-access baseline (Locales + NPCs)

Landed baseline includes:

- player-facing World surface exposing Locales and NPCs as read-only references
- DM World top-level utility tabs preserved as Locales / Shop Generator / Rewards / NPCs
- player World excludes Shop Generator and Rewards
- player locale shop view keeps descriptive/shop worldbuilding detail while excluding locale shop inventory stock rows and DM assignment/sell actions
- player NPC view includes searchable list, portrait thumbnails, and full NPC detail card, but excludes create/edit management actions

Preservation rule:

- keep player world access strictly view-only and preserve DM-only mutation workflows

### 20) NPC portrait upload baseline

Landed baseline includes:

- NPC editor portrait flow now supports in-app upload, preview, replacement, and removal
- NPC records now support storage-path-backed portrait references in addition to legacy URL compatibility
- NPC detail and list rendering now resolve app-managed portrait storage paths with clean no-image fallbacks

Preservation rule:

- keep portrait handling app-managed and mobile-friendly; avoid returning to raw external-hosting-only workflow


### 21) Equipment + attunement Phase 1 baseline

Landed baseline includes:

- item mechanics enrichment overlay artifact (`docs/data/item_mechanics_enrichment_2014.json` + `public/data/item_mechanics_enrichment_2014.json`) merged into the existing SRD/custom import lane
- explicit **Phase 1 curated coverage model**: only enrichment-listed items are treated as `phase1_supported`; non-listed items remain manual/unsupported for automation in this phase
- import mapping now sets `requires_attunement` from trusted SRD detail text (`requires attunement`) in addition to name-shape detection so attunement truth does not rely on item-title formatting
- curated mechanics semantics corrections landed: Cloak of Protection now uses attunement-only activation with no forced visible neck slot; Wand of Magic Missiles now correctly records `requires_attunement=true`
- abstract generic enhancement rows (`+1/+2/+3 Armor`, `+1/+2/+3 Weapon`, `+1/+2/+3 Shield`) are now quarantined from mechanics/shop eligibility and no longer treated as concrete equipable definitions
- SRD import now materializes explicit concrete enhanced variant rows as **catalog-prep groundwork only** (stable slugs + mechanics payload + shop-intent metadata), but these generated variants are intentionally non-live for current shop/equipment support (`is_shop_eligible=false`, non-`phase1_supported`)
- inventory item instance-state support for `equipped`, `attuned`, and durable `current_charges`
- RPC-backed equip/unequip/attune/unattune/recharge actions
- player inventory organization into Items / Equipment / Attunement lanes with rest-context attunement gating
- short-rest response attunement selection capture and DM confirmation application
- long-rest prep now includes a first-class Attunement + Recharge section in the long-rest flow (not inventory-modal side detour)
- shared derived-player-stats helper path now applies supported item effects (armor formula, AC flat/shield, all-saves/specific saves, spell attack/DC bonuses, ability-score floor/bonus) while preserving manual profile bonus fields
- inventory modal mobile polish follow-up: Items / Equipment / Attunement tabs now sit in one balanced row with search-first scanning (wasteful heading/explanatory copy removed)
- short-rest dock action label now fits cleanly on mobile while preserving active-state clarity
- profile Derived Combat Maths now again exposes AC with a dedicated custom AC modifier field
- item detail modals (inventory/world/rewards/locale shop) now include a distinct Mechanics & Stat Bonuses block so supported mechanics are testable independent of prose description

Preservation rule:

- keep manual profile bonus boxes and layer item automation on top rather than replacing those controls

### 22) Raw items source + source-split derived curation layer

Landed baseline includes:

- `resources/items_by_source/` as the upstream in-repo source layer for item conversion/import work (manifest + curated surviving per-source JSON files)
- deterministic converter output artifacts at `docs/data/shop_5etools_items_source_split_2014.json` and `public/data/shop_5etools_items_source_split_2014.json`, mapped into the existing app import row shape
- Manage → Imports now includes a DM-only live review/export panel for imported 5etools-lane `item_master` rows (lane-scoped counts + compact row list + copy/export JSON) for truthfulness validation directly in app flow
- Manage → Imports review now also emits a structured JSON report export for operator follow-up (priced-by-source, unresolved/unpriced, overlay-excluded, should-be-priced-not-matched, should-never-default-to-shop, shop-eligible/non-shop, mechanics-support and structured/null mechanics slices, attunement slice, and Phase-1-compatible payload slice)
- converter/report attunement truthfulness hardening now derives runtime `requires_attunement` from direct + nested mechanics + raw attunement source signals so imported 5etools rows do not strand attunement only in nested metadata
- structured review report now computes attunement and Phase-1-compatible payload slices from runtime-meaningful attunement/mechanics truth (including mechanics-vs-runtime attunement consistency), preventing over-optimistic compatibility counts
- converter mechanics family enrichment now promotes high-value passive families (ability-score set-min/bonuses, passive AC/saving-throw bonuses, and passive spell attack/save bonuses) to truthful `phase1_supported` payloads when they fit the existing runtime effect semantics
- durable execution plan for completion work is now tracked in `docs/5ETOOLS_IMPORT_COMPLETION_PLAN.md`
- 5etools conversion now reuses the same curated magic-pricing overlay artifact (`shop_magic_pricing_2014.json`) already used by SRD import paths, including alias-aware name matching for common plus-order variant naming differences
- 5etools conversion now applies a constrained fallback pricing policy only when direct source value and curated overlay matching are both unavailable, with explicit provenance markers (`5etools_fallback_policy_v1`) and non-default/manual behavior preserved for excluded/high-risk rows
- targeted pricing completion follow-up now applies curated family-level fallback pricing for the former `still_unpriced_but_priceable` residue (including ring-of-resistance, scroll-of-protection, figurine/carpet/horn clusters, TCE/BMT named residue clusters, and selected named outliers) while preserving explicit manual-only handling for deck-chaos/high-swing outliers
- source-split generation now also reads declared supplemental upstream input `resources/items_by_source/items-base.json` (`baseitem` path) with source+name identity dedupe against curated source files, restoring omitted baseline PHB/SRD combat equipment rows (for example Dagger, Longsword, Leather Armor, Shield) without requiring a full monolith re-split
- source-split conversion now also adds deterministic generated canonical ordinary +1/+2/+3 weapon/armor/shield families from trusted PHB mundane base rows already in the pipeline, with explicit generated provenance metadata and no broad magical-variants monolith ingestion
- latest regeneration after items-base supplementation: 1,016 total rows processed from curated+supplemental upstream inputs, 140 clutter-policy exclusions, and 876 active-lane rows with no source+name duplicate rows in the emitted artifact
- latest regenerated 5etools artifact state after targeted still-unpriced completion pass (`5etools_shop_admission_v2`): 892 source rows processed with 140 clutter-family rows excluded from the active artifact (gem/art/coin/trade-good/ship-airship/large-vehicle families), leaving 752 active-lane rows; active-lane pricing provenance now splits to direct source value (152), curated overlay (251), fallback policy (272), and unresolved manual (92), unresolved triage now at 0 overlay-match-miss candidates + 18 intentionally excluded/noise + 74 true manual residues, final manual-policy buckets at 71 `manual_only_forever`, 197 `curated_magic_nondefault`, 76 `curated_magic_shop_stock`, and 0 `still_unpriced_but_priceable`, with shop split at 445 shop-eligible / 307 non-shop and structured mechanics + Phase-1-compatible payload coverage at 243
- practical lane status: 5etools import lane is now considered ready to replace the old SRD-source import lane for day-to-day item catalog operation, while legacy SRD refresh controls remain temporarily available as explicitly deprecated fallback tooling
- explicit boundary that neither raw source nor source-split derivatives are the live runtime schema; runtime item truth remains the existing `item_master` import/runtime path

Preservation rule:

- keep converter/import work reading from these source materials and mapping into the existing app import/runtime shape without directly wiring runtime reads to the source-split files
