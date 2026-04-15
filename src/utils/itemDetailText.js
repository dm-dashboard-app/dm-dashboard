function textValue(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
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
