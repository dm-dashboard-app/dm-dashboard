# Items-base Upstream Restore Report (April 18, 2026)

## Scope

Patch: `add-items-base-upstream-source-to-restore-missing-basic-combat-items`

Goal: restore missing baseline PHB/SRD combat-equipment rows in the source-split generated import artifact by adding `items-base.json` as a supplemental upstream input, without a full monolith re-split.

## What changed

- Updated source-split converter input loading to read `resources/items_by_source/items-base.json` (`baseitem` path) when declared in manifest supplemental inputs.
- Added controlled supplemental-input declaration in `resources/items_by_source/manifest.json`.
- Kept curated-file trust checks (`total_source_file_count`, curated item total) intact.
- Added stable identity handling for supplemental merge input:
  - identity key: normalized `source + name`
  - supplemental rows are skipped when that identity already exists in curated rows
- Regenerated:
  - `docs/data/shop_5etools_items_source_split_2014.json`
  - `public/data/shop_5etools_items_source_split_2014.json`

## Regeneration results

- Curated upstream item total (manifest): **892**
- Supplemental `items-base.json` rows ingested: **124**
- Total rows processed from upstream inputs: **1,016**
- Excluded from active lane by existing clutter policy: **140**
- Active-lane converted rows emitted: **876**
- Source+name duplicate rows in emitted active artifact: **0**

## Baseline combat-equipment verification

Confirmed present in regenerated active artifact:

- `Dagger` (PHB)
- `Longsword` (PHB)
- `Leather Armor` (PHB)
- `Shield` (PHB)

Representative spread confirmed present:

- weapons: `Club`, `Mace`, `Spear`, `Shortbow`
- armor: `Chain Mail`, `Plate Armor`

## Enhancement-family spot check

- `+1` weapon-family example present in active artifact: `+1 Moon Sickle`.
- `+1` armor/shield-family examples were **not** found in current active-lane output after policy filtering; this remains governed by existing admission/curation policy rather than upstream absence.

## Remaining obvious baseline gaps

- No obvious missing baseline basic combat rows were found for the targeted verification set in this patch.
- `Crossbow, Light` was not found under that exact name; 5etools naming may use alternate canonical text (for example `Light Crossbow`) and should be checked by alias if needed in a follow-up.
