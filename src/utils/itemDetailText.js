function textValue(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function titleCase(value) {
  return String(value || '')
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1))
    .join(' ');
}

function listFromMetadata(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') return textValue(entry);
      const name = textValue(entry?.item?.name || entry?.name || entry?.property?.name);
      if (!name) return null;
      const qty = Number(entry?.quantity);
      if (Number.isFinite(qty) && qty > 1) return `${qty}x ${name}`;
      return name;
    })
    .filter(Boolean);
}

function extractDetailTextFromMetadata(metadata = {}) {
  const contents = listFromMetadata(metadata.contents);
  const properties = listFromMetadata(metadata.properties);
  const special = listFromMetadata(metadata.special);
  const desc = listFromMetadata(metadata.desc);
  const blocks = [];
  if (desc.length) blocks.push(desc.join('\n\n'));
  if (special.length) blocks.push(special.join('\n\n'));
  if (contents.length) blocks.push(`Contents: ${contents.join(', ')}`);
  if (properties.length) blocks.push(`Properties: ${properties.join(', ')}`);
  return blocks.join('\n\n').trim() || null;
}

function buildStructuredFallback(item = {}) {
  const lines = [];
  lines.push(`Type: ${textValue(item.item_type) || 'Unknown'}`);
  if (textValue(item.category)) lines.push(`Category: ${item.category}`);
  if (textValue(item.subcategory)) lines.push(`Subcategory: ${item.subcategory}`);
  if (textValue(item.rarity)) lines.push(`Rarity: ${item.rarity}`);
  if (item.requires_attunement === true) lines.push('Attunement: Required');
  if (item.requires_attunement === false) lines.push('Attunement: Not required');
  if (textValue(item.shop_bucket)) lines.push(`Shop bucket: ${item.shop_bucket}`);

  const metadata = item.metadata_json || {};
  const contents = listFromMetadata(metadata.contents);
  if (contents.length) lines.push(`Contents: ${contents.join(', ')}`);
  const properties = listFromMetadata(metadata.properties);
  if (properties.length) lines.push(`Properties: ${properties.join(', ')}`);

  return lines.join('\n');
}

export function resolveItemDetailText(item = {}) {
  const primaryDescription = textValue(item.description);
  if (primaryDescription) return { text: primaryDescription, mode: 'description' };

  const metadataDescription = extractDetailTextFromMetadata(item.metadata_json || {});
  if (metadataDescription) return { text: metadataDescription, mode: 'metadata' };

  return { text: buildStructuredFallback(item), mode: 'structured_fallback' };
}

export function compactItemMeta(item = {}) {
  return [
    textValue(item.item_type),
    textValue(item.category),
    textValue(item.subcategory),
    textValue(item.rarity),
  ].filter(Boolean);
}

export function getItemMechanicsSummary(item = {}) {
  const metadata = item?.metadata_json || {};
  const mechanics = metadata.mechanics || {};
  const support = String(metadata.mechanics_support || 'unsupported');
  const lines = [];

  if (support !== 'unsupported') {
    lines.push({ label: 'Support', value: titleCase(support) });
  }

  if (typeof mechanics.requires_attunement === 'boolean' || typeof item?.requires_attunement === 'boolean') {
    const requiresAttunement = typeof mechanics.requires_attunement === 'boolean'
      ? mechanics.requires_attunement
      : !!item.requires_attunement;
    lines.push({ label: 'Requires Attunement', value: requiresAttunement ? 'Yes' : 'No' });
  }

  if (mechanics.slot_family) {
    lines.push({ label: 'Slot', value: titleCase(mechanics.slot_family) });
  }

  if (mechanics.activation_mode) {
    lines.push({ label: 'Activation', value: titleCase(mechanics.activation_mode) });
  }

  const armor = mechanics.armor || null;
  if (armor && typeof armor.base_ac !== 'undefined') {
    const parts = [`Base AC ${Number(armor.base_ac) || 0}`];
    if (armor.add_dex === false) parts.push('No DEX');
    else if (typeof armor.dex_cap === 'number') parts.push(`DEX cap ${armor.dex_cap}`);
    else parts.push('Add DEX');
    lines.push({ label: 'Armor Formula', value: parts.join(' • ') });
  }

  const passiveEffects = Array.isArray(mechanics.passive_effects) ? mechanics.passive_effects : [];
  passiveEffects.forEach((effect) => {
    const type = String(effect?.type || '').toLowerCase();
    const value = Number(effect?.value) || 0;
    if (!type) return;
    if (type === 'ac_flat') lines.push({ label: 'AC Bonus', value: `${value >= 0 ? '+' : ''}${value}` });
    else if (type === 'shield_ac_bonus') lines.push({ label: 'Shield AC Bonus', value: `${value >= 0 ? '+' : ''}${value}` });
    else if (type === 'spell_attack_bonus') lines.push({ label: 'Spell Attack Bonus', value: `${value >= 0 ? '+' : ''}${value}` });
    else if (type === 'spell_save_dc_bonus') lines.push({ label: 'Spell Save DC Bonus', value: `${value >= 0 ? '+' : ''}${value}` });
    else if (type === 'all_saves_bonus') lines.push({ label: 'Saving Throws', value: `${value >= 0 ? '+' : ''}${value} to all saves` });
    else if (type === 'saving_throw_bonus') lines.push({ label: 'Saving Throws', value: `${titleCase(effect?.save || 'save')} ${value >= 0 ? '+' : ''}${value}` });
    else if (type === 'ability_score_bonus') lines.push({ label: 'Ability Bonus', value: `${String(effect?.ability || '').toUpperCase()} ${value >= 0 ? '+' : ''}${value}` });
    else if (type === 'ability_score_set_min') lines.push({ label: 'Ability Floor', value: `Set ${String(effect?.ability || '').toUpperCase()} minimum ${Number(effect?.min) || 0}` });
    else if (type === 'flat_bonus') {
      const target = String(effect?.target || '').toLowerCase();
      if (target === 'ac') lines.push({ label: 'AC Bonus', value: `${value >= 0 ? '+' : ''}${value}` });
      if (target === 'spell_attack') lines.push({ label: 'Spell Attack Bonus', value: `${value >= 0 ? '+' : ''}${value}` });
      if (target === 'spell_save_dc') lines.push({ label: 'Spell Save DC Bonus', value: `${value >= 0 ? '+' : ''}${value}` });
    }
  });

  const charges = mechanics.charges || null;
  if (charges && typeof charges.max !== 'undefined') {
    lines.push({ label: 'Charges', value: `Max ${Number(charges.max) || 0}` });
    if (charges.recharge) lines.push({ label: 'Recharge', value: titleCase(charges.recharge) });
    if (typeof charges.allow_when_unattuned === 'boolean') {
      lines.push({ label: 'Recharge While Unattuned', value: charges.allow_when_unattuned ? 'Yes' : 'No' });
    }
  }

  return lines;
}
