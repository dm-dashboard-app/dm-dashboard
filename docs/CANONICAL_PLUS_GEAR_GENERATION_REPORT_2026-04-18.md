# Canonical +1/+2/+3 Gear Generation Report (April 18, 2026)

This batch adds a deterministic generated enhancement lane from trusted mundane PHB base rows already present in the source-split converter input.

## What was added

- Generated canonical enhancement families for **ordinary weapons, armor, and shields**.
- Generation bonuses: **+1, +2, +3**.
- Generation source gate: trusted **PHB mundane base rows** in the active converter row set (`source_layer=5etools_items_by_source_curated`, `source_key=PHB`, `shop_bucket=mundane`, `price_source=5etools_value_cp`, no attunement).
- Generated row provenance marker: `metadata_json.generated_canonical_enhancement`.

## Pricing policy used

Used the existing converter fallback pricing bands (same durable enhancement-family policy lane):

- Weapon: +1=600 gp, +2=6000 gp, +3=50000 gp
- Armor: +1=800 gp, +2=8000 gp, +3=60000 gp
- Shield: +1=800 gp, +2=8000 gp, +3=60000 gp

Generated rows are policy-bucketed as:

- +1 => `curated_magic_shop_stock`
- +2/+3 => `curated_magic_nondefault`

## Explicit non-scope / not included

- No giant magical-variants monolith ingestion.
- No broad named magic-item family ingestion.
- No uncontrolled sourcebook magical variant sweep.
- No non-trusted-source generation in this lane (e.g. non-PHB base rows are not used to mint generated canonical enhancement families).
- No ammunition-family generation (for example Arrow/Bolt rows are excluded).
- No non-table weapon semantics (non-`M`/`R` weapon type codes are excluded from the ordinary weapon lane).

## Regenerated artifact verification snapshot

Artifact: `docs/data/shop_5etools_items_source_split_2014.json`

- `total_items_converted`: 1026
- `generated_canonical_enhancement_rows`: 150
- `generated_canonical_enhancement_rows_by_type`: weapon 111, armor 36, shield 3
- duplicate external keys in final artifact: 0

Representative generated rows confirmed present:

- +1 weapon: `Longsword +1`
- +2 weapon: `Longsword +2`
- +3 weapon: `Longsword +3`
- +1 armor: `Breastplate +1`
- +2 armor: `Breastplate +2`
- +3 armor: `Breastplate +3`
- +1 shield: `Shield +1`
- +2 shield: `Shield +2`
- +3 shield: `Shield +3`
