const SCROLL_RARITY_BY_LEVEL = {
  1: 'Common',
  2: 'Common',
  3: 'Uncommon',
  4: 'Uncommon',
  5: 'Rare',
  6: 'Rare',
  7: 'Very Rare',
  8: 'Very Rare',
  9: 'Legendary',
};

const SCROLL_PRICE_BY_LEVEL = {
  1: 75,
  2: 150,
  3: 300,
  4: 600,
  5: 1500,
  6: 3500,
  7: 10000,
  8: 15000,
  9: 25000,
};

export function spellLevelOrdinal(level) {
  const n = Number(level || 0);
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

export function formatSpellScrollName(level, spellName) {
  return `Spell Scroll (${spellLevelOrdinal(level)} Level) — ${String(spellName || '').trim()}`;
}

export function getEligibleSpellsForLevel(spells = [], level) {
  const exactLevel = Number(level || 0);
  return (spells || []).filter(spell => {
    const spellLevel = Number(spell?.level || 0);
    const isCantrip = spell?.is_cantrip === true || spellLevel === 0;
    if (!spell?.name || isCantrip) return false;
    return spellLevel === exactLevel && spellLevel >= 1 && spellLevel <= 9;
  });
}

function sampleWithoutReplacement(pool = [], count = 1) {
  const copy = [...pool];
  const result = [];
  while (copy.length > 0 && result.length < count) {
    const index = Math.floor(Math.random() * copy.length);
    result.push(copy[index]);
    copy.splice(index, 1);
  }
  return result;
}

export function generateSpellScrollBatch(spells = [], { level = 1, quantity = 1 } = {}) {
  const exactLevel = Math.max(1, Math.min(9, Number(level || 1)));
  const targetQty = Math.max(1, Math.floor(Number(quantity || 1)));
  const eligible = getEligibleSpellsForLevel(spells, exactLevel);
  if (eligible.length === 0) return [];

  const uniqueCount = Math.min(targetQty, eligible.length);
  const picked = sampleWithoutReplacement(eligible, uniqueCount);

  while (picked.length < targetQty) {
    picked.push(eligible[Math.floor(Math.random() * eligible.length)]);
  }

  return picked.map(spell => ({
    ...spell,
    scroll_name: formatSpellScrollName(exactLevel, spell.name),
    scroll_level: exactLevel,
  }));
}

export function buildSpellScrollItem(spell = {}, level, { assignableItemId = null } = {}) {
  const spellId = spell.id || spell.spellId || spell.spell_id || spell.name;
  return {
    id: `spell-scroll:${level}:${spellId}`,
    item_master_id: assignableItemId || null,
    name: formatSpellScrollName(level, spell.name),
    item_type: 'magic_item',
    category: 'Spell Scroll',
    subcategory: 'spell_scroll',
    rarity: SCROLL_RARITY_BY_LEVEL[level] || 'Rare',
    description: `A spell scroll containing ${spell.name}.`,
    source_type: 'spell_scroll_generated',
    source_book: 'Spells Table',
    price_source: 'spell_scroll_level_baseline',
    shop_bucket: level <= 5 ? 'utility' : 'magic',
    suggested_price_gp: SCROLL_PRICE_BY_LEVEL[level] || 2500,
    rules_era: '2014',
    is_shop_eligible: true,
    metadata_json: {
      spell_scroll: true,
      spell_id: spell.id || spell.spellId || null,
      spell_name: spell.name || '',
      spell_level: level,
      assignable_item_id: assignableItemId || null,
    },
  };
}
