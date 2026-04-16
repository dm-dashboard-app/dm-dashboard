# DM Dashboard — Project Brief

Last updated: April 15, 2026 (World player read access + NPC portrait upload workflow landed)

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

Preservation rule:

- keep default generation safe-by-default for special/problematic magic items while leaving manual curation to future explicit phases


### 13) Custom/homebrew/private import lane baseline (Stage 4)

Landed baseline includes:

- DM Manage → Imports now hosts explicit one-action import controls for baseline SRD refresh and custom-seed import
- DM Manage → Imports also hosts the SRD spell import control so import admin actions are centralized in one tab
- import writes now run through a server-mediated RPC (`dm_import_item_master_rows`) instead of requiring terminal-only scripts for normal operator workflow
- SRD refresh now treats upstream detail fetch failures as transient run-time failures (reported in UI) and no longer persists new degraded fallback rows from those failures into `item_master`
- import RPC now hard-rejects degraded SRD payload rows (`degraded_import`, `degraded_fallback`, `fallback_quarantine`, `degraded_fallback_untrusted`) so client regressions cannot persist untrusted degraded SRD rows
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
- degraded repair coverage now includes explicit per-item outcomes for the remaining target set in `docs/degraded-srd-item-master-rows.json` (78 rows): 51 rows repaired to trustworthy catalog shape and 27 rows marked `excluded_on_purpose` with explicit reasons (0 unresolved rows in that remaining target set)

Preservation rule:

- keep quarantine default-on for degraded SRD fallbacks and only clear it through explicit trustworthy repair data


### 15) Inventory subsystem baseline (Phase 1)

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

Inventory/equipment/abilities beyond Phase 1 remains a **planning track**. Future phases should stay phased and aligned with shared modifier-logic architecture (as outlined in `docs/NEXT_STEPS.md`).

### 17) World locales + district/shop persistence baseline

Landed baseline includes:

- World top-level tabs expanded to **Locales / Shop Generator / Rewards / NPCs**
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
