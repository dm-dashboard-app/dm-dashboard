# 5etools Import Completion Plan (Pricing Truth + Phase 1 Mechanics)

Last updated: April 17, 2026

Purpose: durable repo-grounded execution plan to finish the curated 5etools `item_master` lane for truthful pricing and practical Phase 1 equipment/attunement usefulness.

## Current live pipeline (verified from repo)

1. **Source split conversion**
   - Converter reads `resources/items_by_source/manifest.json` + source files, maps to app import-row shape, and writes generated artifacts in `docs/data` + `public/data`.
   - Price provenance currently resolves in this order: direct source `value` (cp -> gp), curated `shop_magic_pricing_2014_overlay`, then fallback policy `5etools_fallback_policy_v1`.
2. **Import path**
   - DM Manage → Imports “Import Curated 5etools Items” pushes generated rows through existing `dm_import_item_master_rows` RPC into `item_master`.
3. **Runtime boundary**
   - Runtime still consumes `item_master`; raw 5etools/source-split files are import inputs only.
4. **Shop generation gate**
   - Shop generator gate remains `rules_era=2014`, `is_shop_eligible=true`, non-excluded bucket/overlay states, with additional magic-shop rarity/price constraints.
5. **Mechanics activation gate**
   - Item mechanics automation only applies to `metadata_json.mechanics_support = 'phase1_supported'` rows in current equip/attune-derived-stat flow.

## Remaining blockers to “fully online”

1. **Pricing review slices were not explicit enough**
   - Operator could view raw imported rows, but not export ready-made JSON slices for: direct/overlay/fallback/unpriced/excluded/manual categories.
2. **Shop-admission truth needed explicit reporting, not inference**
   - `is_shop_eligible` and bucket semantics exist, but operator lacked one structured export for “shop eligible vs non-shop + why-like buckets.”
3. **Mechanics completion targeting was opaque**
   - `manual_required` / `partial_supported` counts existed, but no export slice for “structured mechanics present”, attunement subset, and “payload appears Phase-1-compatible”.
4. **No durable completion plan artifact for this lane**
   - Prior work landed incrementally; repo needed one implementation-oriented plan that maps remaining work into clear follow-up batches.

## What this batch adds (operator/reporting scaffolding)

- A structured exported review report built from live imported 5etools `item_master` rows.
- New JSON slices now available in Manage → Imports for copy/export:
  - pricing by source: direct source value / curated overlay / fallback policy
  - unresolved unpriced rows
  - overlay-excluded rows
  - should-be-priced-but-not-matched rows
  - should-never-default-to-shop rows
  - shop-eligible rows vs non-shop rows
  - mechanics support counts
  - rows with structured mechanics vs null mechanics
  - rows with `requires_attunement=true`
  - rows whose payload appears compatible with current Phase 1 effect parser

## Completion plan (next ~5 batches)

### Batch 1 — landed in this PR: reporting + plan baseline

- Deliver structured report export in existing Manage → Imports panel.
- Land durable completion plan doc (this document).

### Batch 2 — pricing truthfulness hard split + policy tightening

Automatable:
- Tighten converter-side fallback admission defaults so fallback-priced rows are non-shop by default unless family-specific allowlist criteria are met.
- Add explicit metadata policy tags for shop-admission rationale (`admission_policy`, `admission_reason`) for review transparency.

Needs user judgment/curation:
- Confirm final allowlist thresholds for fallback-priced consumables/common utility rows.

### Batch 3 — overlay gap closure for should-be-priced rows

Automatable:
- Use structured report slice `should_be_priced_but_not_matched` to generate curation candidate pack grouped by normalized names/source.
- Add deterministic alias expansion rules for known naming patterns before declaring unresolved.

Needs user judgment/curation:
- Curate additions to `shop_magic_pricing_2014.json` for true manual decisions (exclude vs priced).

### Batch 4 — Phase 1 mechanics high-value family enrichment

Prioritize families that current runtime can consume with minimal widening:
1. spell attack bonus / spell save DC bonus items
2. weapon bonus items
3. AC bonus / shield / armor formula items
4. saving throw bonus items
5. attunement-gated passive items that map to existing passive effect types

Automatable:
- Map additional source patterns into existing supported effect types.
- Promote rows from `partial_supported` to `phase1_supported` only where payload is fully compatible.

Needs user judgment/curation:
- Park/keep manual anything requiring bespoke encounter logic, summons, campaign-warping powers, or non-passive bespoke activation systems.

### Batch 5 — “replace SRD import lane” readiness gate definition + verification run

Done-enough gate to declare 5etools lane ready to replace old SRD import path (without removing controls yet):
- pricing: unresolved/unpriced and should-be-priced-not-matched rows reduced to a curated, explicitly acknowledged residue
- shop: fallback/manual/excluded categories clearly non-default in generated stock unless explicitly allowed
- mechanics: targeted high-value families have truthful `phase1_supported` coverage and can be validated in runtime derived stats
- reporting: structured export still provides operator truth snapshots for future curation cycles

## User-input/curation boundaries

User/curator decisions remain required for:
- final pricing of subjective/high-impact magic items
- explicit exclusions for campaign-warping/special-case artifacts
- any item family that needs bespoke one-off runtime logic beyond current Phase 1 passive/equip/attunement model

## Out of scope (explicit)

- no runtime redesign away from `item_master`
- no direct runtime dependency on raw 5etools files
- no spells/classes/feats widening
- no SRD import removal in this batch
- no broad bespoke magic-item engine
