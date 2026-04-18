const MANUAL_BUCKETS = new Set([
  'manual_magic_review',
  'manual_only_forever',
  'curated_magic_nondefault',
  'still_unpriced_but_priceable',
  'manual_unpriced',
  'unpriced',
  'excluded',
  'gamechanging',
  'special',
  'artifact',
  'fallback_quarantine',
]);

const POLICY_DEMOTED_DECISIONS = new Set(['demoted_non_shop']);
const CATALOG_NOISE_BUCKETS = new Set(['catalog_noise_excluded', 'hazardous_non_default']);

const PHASE1_ALLOWED_SLOTS = new Set(['armor', 'shield', 'main_hand', 'off_hand', 'neck', 'ring', 'inventory']);
const PHASE1_ALLOWED_ACTIVATION = new Set(['equip', 'attunement_only']);
const PHASE1_ALLOWED_EFFECT_TYPES = new Set([
  'flat_bonus',
  'ac_flat',
  'shield_ac_bonus',
  'spell_save_dc_bonus',
  'spell_attack_bonus',
  'ability_score_bonus',
  'ability_score_set_min',
  'all_saves_bonus',
  'saving_throw_bonus',
  'weapon_attack_bonus',
]);

function normalize(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeFamilyKey(name = '') {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^\+\d+\s+/, '')
    .replace(/[,'’]/g, '')
    .replace(/\((cantrip|\d+(st|nd|rd|th)\s+level|small|medium|large|air|earth|fire|water|chaotic|evil|good|lawful)\)/gi, '')
    .replace(/\s+\+\d+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseAttunementFlag(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = normalize(value);
    if (!normalized) return null;
    if (normalized === 'false' || normalized === 'no' || normalized === 'none') return false;
    return true;
  }
  return null;
}

function hasAttunementSignals(row = {}) {
  const reqAttuneRaw = row?.metadata_json?.req_attune_raw;
  const parsedRaw = parseAttunementFlag(reqAttuneRaw);
  if (parsedRaw === true) return true;
  if (Array.isArray(row?.metadata_json?.req_attune_tags) && row.metadata_json.req_attune_tags.length > 0) return true;
  return false;
}

export function resolveRuntimeAttunementTruth(row = {}) {
  const mechanicsAttunement = parseAttunementFlag(row?.metadata_json?.mechanics?.requires_attunement);
  if (mechanicsAttunement !== null) return mechanicsAttunement;

  const topLevel = parseAttunementFlag(row?.requires_attunement);
  if (topLevel !== null) return topLevel;

  if (hasAttunementSignals(row)) return true;
  return false;
}

function compactRow(row = {}) {
  return {
    external_key: row.external_key,
    name: row.name,
    item_type: row.item_type,
    category: row.category,
    subcategory: row.subcategory,
    rarity: row.rarity,
    requires_attunement: resolveRuntimeAttunementTruth(row),
    is_shop_eligible: !!row.is_shop_eligible,
    shop_bucket: row.shop_bucket || null,
    catalog_admission_decision: row?.metadata_json?.catalog_admission?.active_lane_decision || null,
    catalog_admission_reason: row?.metadata_json?.catalog_admission?.reason || null,
    base_price_gp: row.base_price_gp,
    suggested_price_gp: row.suggested_price_gp,
    price_source: row.price_source || null,
    source_key: row?.metadata_json?.source_key || null,
    source_filename: row?.metadata_json?.source_filename || null,
    source_page: row?.metadata_json?.source_page ?? null,
    mechanics_support: row?.metadata_json?.mechanics_support || 'unknown',
    has_structured_mechanics: !!row?.metadata_json?.mechanics,
  };
}

function hasOverlayExclusion(row = {}) {
  const pricingOverlay = row?.metadata_json?.pricing_overlay || {};
  return !!pricingOverlay.exclude_from_shop || !!String(pricingOverlay.exclusion_reason || '').trim();
}

function appearsMagical(row = {}) {
  if (normalize(row.item_type) === 'magic_item') return true;
  if (row.requires_attunement) return true;
  if (row.rarity && normalize(row.rarity) !== 'none') return true;
  return false;
}

export function looksPhase1Compatible(row = {}) {
  const mechanics = row?.metadata_json?.mechanics;
  if (!mechanics || typeof mechanics !== 'object') return false;
  const runtimeRequiresAttunement = resolveRuntimeAttunementTruth(row);

  const slot = normalize(mechanics.slot_family);
  if (!slot || !PHASE1_ALLOWED_SLOTS.has(slot)) return false;

  const activation = normalize(mechanics.activation_mode || 'equip');
  if (!activation || !PHASE1_ALLOWED_ACTIVATION.has(activation)) return false;

  const mechanicsRequiresAttunement = parseAttunementFlag(mechanics.requires_attunement);
  if (runtimeRequiresAttunement && mechanicsRequiresAttunement !== true) return false;
  if (!runtimeRequiresAttunement && mechanicsRequiresAttunement === true) return false;

  const passive = Array.isArray(mechanics.passive_effects) ? mechanics.passive_effects : [];
  for (const effect of passive) {
    const type = normalize(effect?.type);
    if (!type || !PHASE1_ALLOWED_EFFECT_TYPES.has(type)) return false;
  }

  const armor = mechanics.armor;
  if (armor) {
    if (!Number.isFinite(Number(armor.base_ac))) return false;
    if (armor.dex_cap !== null && armor.dex_cap !== undefined && !Number.isFinite(Number(armor.dex_cap))) return false;
  }

  if (mechanics.charges && !Number.isFinite(Number(mechanics.charges.max))) return false;

  return true;
}

function buildBucket(rows = []) {
  return rows.map(compactRow);
}

export function build5etoolsReviewReport(rows = []) {
  const directSourcePriced = rows.filter(row => row.price_source === '5etools_value_cp');
  const overlayPriced = rows.filter(row => row.price_source === 'shop_magic_pricing_2014_overlay');
  const fallbackPriced = rows.filter(row => row.price_source === '5etools_fallback_policy_v1');
  const unresolvedUnpriced = rows.filter(row => row.base_price_gp == null || row.suggested_price_gp == null || !row.price_source);
  const overlayExcluded = rows.filter(row => hasOverlayExclusion(row));
  const unresolvedOverlayExcluded = unresolvedUnpriced.filter(row => hasOverlayExclusion(row));
  const unresolvedWithCatalogExclusion = unresolvedUnpriced.filter((row) => {
    const decision = normalize(row?.metadata_json?.catalog_admission?.active_lane_decision);
    return decision === 'excluded' || CATALOG_NOISE_BUCKETS.has(normalize(row.shop_bucket));
  });

  const familyPricedRows = new Set();
  rows.forEach((row) => {
    if (!row?.price_source) return;
    const familyKey = normalizeFamilyKey(row.name);
    if (familyKey) familyPricedRows.add(familyKey);
  });

  const unresolvedOverlayMatchMissCandidates = unresolvedUnpriced.filter((row) => {
    const strategy = normalize(row?.metadata_json?.pricing?.strategy);
    if (strategy !== 'unresolved_manual_review') return false;
    if (!appearsMagical(row)) return false;
    if (hasOverlayExclusion(row)) return false;
    const familyKey = normalizeFamilyKey(row.name);
    return !!familyKey && familyPricedRows.has(familyKey);
  });

  const unresolvedManualReview = unresolvedUnpriced.filter((row) => {
    if (unresolvedOverlayMatchMissCandidates.includes(row)) return false;
    if (unresolvedOverlayExcluded.includes(row)) return false;
    if (unresolvedWithCatalogExclusion.includes(row)) return false;
    return true;
  });
  const unresolvedIntentionallyExcludedOrNoise = Array.from(new Set([
    ...unresolvedOverlayExcluded,
    ...unresolvedWithCatalogExclusion,
  ]));

  const shouldBePricedNotMatched = rows.filter((row) => {
    const strategy = normalize(row?.metadata_json?.pricing?.strategy);
    return strategy === 'unresolved_manual_review' && appearsMagical(row) && !hasOverlayExclusion(row);
  });
  const shouldNeverDefaultToShop = rows.filter((row) => {
    const bucket = normalize(row.shop_bucket);
    return MANUAL_BUCKETS.has(bucket) || hasOverlayExclusion(row);
  });
  const policyDemotedNonShop = rows.filter((row) => POLICY_DEMOTED_DECISIONS.has(normalize(row?.metadata_json?.catalog_admission?.active_lane_decision)));
  const catalogNoiseNonShop = rows.filter((row) => CATALOG_NOISE_BUCKETS.has(normalize(row.shop_bucket)));

  const byMechanicsSupport = rows.reduce((acc, row) => {
    const key = row?.metadata_json?.mechanics_support || 'unknown';
    return { ...acc, [key]: Number(acc[key] || 0) + 1 };
  }, {});

  const rowsWithStructuredMechanics = rows.filter(row => !!row?.metadata_json?.mechanics);
  const rowsWithNullMechanics = rows.filter(row => !row?.metadata_json?.mechanics);
  const rowsWithAttunement = rows.filter(resolveRuntimeAttunementTruth);
  const rowsWithPhase1CompatiblePayload = rows.filter(looksPhase1Compatible);

  const shopEligibleRows = rows.filter(row => row.is_shop_eligible);
  const nonShopRows = rows.filter(row => !row.is_shop_eligible);
  const manualMagicReviewRows = rows.filter((row) => normalize(row.shop_bucket) === 'manual_magic_review');
  const manualOnlyForeverRows = rows.filter((row) => normalize(row.shop_bucket) === 'manual_only_forever');
  const curatedMagicNondefaultRows = rows.filter((row) => normalize(row.shop_bucket) === 'curated_magic_nondefault');
  const curatedMagicShopStockRows = rows.filter((row) => normalize(row.shop_bucket) === 'curated_magic_shop_stock');
  const stillUnpricedButPriceableRows = rows.filter((row) => normalize(row.shop_bucket) === 'still_unpriced_but_priceable');

  return {
    generated_at: new Date().toISOString(),
    source_layer: '5etools_items_by_source_curated',
    total_rows: rows.length,
    counts: {
      direct_source_priced: directSourcePriced.length,
      overlay_priced: overlayPriced.length,
      fallback_priced: fallbackPriced.length,
      unresolved_unpriced: unresolvedUnpriced.length,
      overlay_excluded: overlayExcluded.length,
      should_be_priced_but_not_matched: shouldBePricedNotMatched.length,
      unresolved_overlay_match_miss_candidates: unresolvedOverlayMatchMissCandidates.length,
      unresolved_intentionally_excluded_or_noise: unresolvedIntentionallyExcludedOrNoise.length,
      unresolved_true_manual_review: unresolvedManualReview.length,
      should_never_default_to_shop: shouldNeverDefaultToShop.length,
      policy_demoted_non_shop: policyDemotedNonShop.length,
      catalog_noise_non_shop: catalogNoiseNonShop.length,
      shop_eligible: shopEligibleRows.length,
      non_shop: nonShopRows.length,
      manual_magic_review: manualMagicReviewRows.length,
      manual_only_forever: manualOnlyForeverRows.length,
      curated_magic_nondefault: curatedMagicNondefaultRows.length,
      curated_magic_shop_stock: curatedMagicShopStockRows.length,
      still_unpriced_but_priceable: stillUnpricedButPriceableRows.length,
      rows_with_structured_mechanics: rowsWithStructuredMechanics.length,
      rows_with_null_mechanics: rowsWithNullMechanics.length,
      rows_with_attunement_true: rowsWithAttunement.length,
      rows_with_phase1_compatible_payload: rowsWithPhase1CompatiblePayload.length,
    },
    pricing: {
      direct_source_value_cp: buildBucket(directSourcePriced),
      curated_overlay_match: buildBucket(overlayPriced),
      fallback_policy_priced: buildBucket(fallbackPriced),
      unresolved_unpriced: buildBucket(unresolvedUnpriced),
      overlay_excluded: buildBucket(overlayExcluded),
      should_be_priced_but_not_matched: buildBucket(shouldBePricedNotMatched),
      unresolved_overlay_match_miss_candidates: buildBucket(unresolvedOverlayMatchMissCandidates),
      unresolved_intentionally_excluded_or_noise: buildBucket(unresolvedIntentionallyExcludedOrNoise),
      unresolved_true_manual_review: buildBucket(unresolvedManualReview),
      should_never_default_to_shop: buildBucket(shouldNeverDefaultToShop),
    },
    shop_admission: {
      shop_eligible_rows: buildBucket(shopEligibleRows),
      non_shop_rows: buildBucket(nonShopRows),
      policy_demoted_non_shop_rows: buildBucket(policyDemotedNonShop),
      catalog_noise_non_shop_rows: buildBucket(catalogNoiseNonShop),
    },
    mechanics: {
      by_mechanics_support: byMechanicsSupport,
      rows_with_structured_mechanics: buildBucket(rowsWithStructuredMechanics),
      rows_with_null_mechanics: buildBucket(rowsWithNullMechanics),
      rows_with_attunement_true: buildBucket(rowsWithAttunement),
      rows_with_phase1_compatible_payload: buildBucket(rowsWithPhase1CompatiblePayload),
    },
  };
}
