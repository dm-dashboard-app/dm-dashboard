import { build5etoolsReviewReport, looksPhase1Compatible, resolveRuntimeAttunementTruth } from './fiveToolsReviewReport';

describe('build5etoolsReviewReport', () => {
  test('builds required pricing/shop/mechanics slices', () => {
    const rows = [
      {
        external_key: 'k:direct',
        name: 'Dagger +1',
        item_type: 'weapon',
        rarity: 'uncommon',
        base_price_gp: 500,
        suggested_price_gp: 500,
        price_source: '5etools_value_cp',
        is_shop_eligible: false,
        shop_bucket: 'manual_magic_review',
        requires_attunement: false,
        metadata_json: {
          source_key: 'DMG',
          mechanics_support: 'partial_supported',
          mechanics: {
            slot_family: 'main_hand',
            activation_mode: 'equip',
            passive_effects: [{ type: 'weapon_attack_bonus', value: 1 }],
          },
        },
      },
      {
        external_key: 'k:overlay-excluded',
        name: 'Orb of Chaos',
        item_type: 'magic_item',
        rarity: 'rare',
        base_price_gp: null,
        suggested_price_gp: null,
        price_source: 'shop_magic_pricing_2014_overlay',
        is_shop_eligible: false,
        shop_bucket: 'manual_magic_review',
        requires_attunement: true,
        metadata_json: {
          pricing_overlay: {
            exclude_from_shop: true,
            exclusion_reason: 'campaign-warping',
          },
          mechanics_support: 'manual_required',
          mechanics: null,
        },
      },
      {
        external_key: 'k:fallback',
        name: 'Cloak of Utility',
        item_type: 'magic_item',
        rarity: 'common',
        base_price_gp: 100,
        suggested_price_gp: 100,
        price_source: '5etools_fallback_policy_v1',
        is_shop_eligible: true,
        shop_bucket: 'utility',
        requires_attunement: true,
        metadata_json: {
          pricing: { strategy: 'fallback_policy' },
          mechanics_support: 'partial_supported',
          mechanics: {
            slot_family: 'neck',
            activation_mode: 'equip',
            requires_attunement: true,
            passive_effects: [{ type: 'flat_bonus', target: 'spell_save_dc', value: 1 }],
          },
        },
      },
      {
        external_key: 'k:hazard',
        name: "Assassin's Blood",
        item_type: 'equipment',
        rarity: null,
        base_price_gp: 150,
        suggested_price_gp: 150,
        price_source: '5etools_value_cp',
        is_shop_eligible: false,
        shop_bucket: 'hazardous_non_default',
        requires_attunement: false,
        metadata_json: {
          pricing: { strategy: 'direct_source_value_cp' },
          mechanics_support: 'manual_required',
          catalog_admission: {
            active_lane_decision: 'demoted_non_shop',
            reason: 'hazardous_poison_non_default_stock',
          },
          mechanics: null,
        },
      },
      {
        external_key: 'k:manual',
        name: 'Mystery Relic',
        item_type: 'magic_item',
        rarity: 'rare',
        base_price_gp: null,
        suggested_price_gp: null,
        price_source: null,
        is_shop_eligible: false,
        shop_bucket: 'manual_magic_review',
        requires_attunement: true,
        metadata_json: {
          pricing: { strategy: 'unresolved_manual_review' },
          mechanics_support: 'manual_required',
          mechanics: null,
        },
      },
      {
        external_key: 'k:nested-attune',
        name: 'Nested Attune Item',
        item_type: 'magic_item',
        rarity: 'uncommon',
        base_price_gp: 300,
        suggested_price_gp: 300,
        price_source: '5etools_fallback_policy_v1',
        is_shop_eligible: false,
        shop_bucket: 'manual_magic_review',
        requires_attunement: false,
        metadata_json: {
          req_attune_raw: 'by a wizard',
          mechanics_support: 'partial_supported',
          mechanics: {
            slot_family: 'main_hand',
            activation_mode: 'equip',
            requires_attunement: true,
            passive_effects: [{ type: 'weapon_attack_bonus', value: 1 }],
          },
        },
      },
    ];

    const report = build5etoolsReviewReport(rows);

    expect(report.total_rows).toBe(6);
    expect(report.counts.direct_source_priced).toBe(2);
    expect(report.counts.overlay_priced).toBe(1);
    expect(report.counts.fallback_priced).toBe(2);
    expect(report.counts.unresolved_unpriced).toBe(2);
    expect(report.counts.overlay_excluded).toBe(1);
    expect(report.counts.should_be_priced_but_not_matched).toBe(1);
    expect(report.counts.policy_demoted_non_shop).toBe(1);
    expect(report.counts.catalog_noise_non_shop).toBe(1);
    expect(report.counts.shop_eligible).toBe(1);
    expect(report.counts.non_shop).toBe(5);
    expect(report.counts.rows_with_structured_mechanics).toBe(3);
    expect(report.counts.rows_with_attunement_true).toBe(4);
    expect(report.counts.rows_with_phase1_compatible_payload).toBe(3);

    expect(report.mechanics.by_mechanics_support.partial_supported).toBe(3);
    expect(report.mechanics.by_mechanics_support.manual_required).toBe(3);

    expect(report.pricing.should_be_priced_but_not_matched[0].external_key).toBe('k:manual');
    expect(report.pricing.overlay_excluded[0].external_key).toBe('k:overlay-excluded');
    expect(report.shop_admission.policy_demoted_non_shop_rows[0].external_key).toBe('k:hazard');
  });
});

describe('resolveRuntimeAttunementTruth', () => {
  test('prefers mechanics attunement truth over stale top-level false', () => {
    expect(resolveRuntimeAttunementTruth({
      requires_attunement: false,
      metadata_json: {
        mechanics: { requires_attunement: true },
      },
    })).toBe(true);
  });
});

describe('looksPhase1Compatible', () => {
  test('accepts current phase1-compatible payload shape', () => {
    expect(looksPhase1Compatible({
      metadata_json: {
        mechanics: {
          slot_family: 'armor',
          activation_mode: 'equip',
          armor: { base_ac: 14, add_dex: true, dex_cap: 2 },
          passive_effects: [{ type: 'shield_ac_bonus', value: 2 }],
          charges: { max: 3 },
        },
      },
    })).toBe(true);
  });

  test('rejects unknown passive effect types', () => {
    expect(looksPhase1Compatible({
      metadata_json: {
        mechanics: {
          slot_family: 'inventory',
          activation_mode: 'equip',
          passive_effects: [{ type: 'summon_army', value: 1 }],
        },
      },
    })).toBe(false);
  });

  test('rejects attunement payloads missing mechanics attunement truth', () => {
    expect(looksPhase1Compatible({
      requires_attunement: true,
      metadata_json: {
        mechanics: {
          slot_family: 'neck',
          activation_mode: 'equip',
          passive_effects: [{ type: 'flat_bonus', target: 'spell_attack', value: 1 }],
        },
      },
    })).toBe(false);
  });
});
