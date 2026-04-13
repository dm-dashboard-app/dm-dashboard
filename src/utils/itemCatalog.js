export const ITEM_RULES_ERA_2014 = '2014';

export function normalizeItemSlug(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .replace(/-{2,}/g, '-');
}

export function buildItemIdentity(item = {}) {
  const name = String(item.name || '').trim();
  const slug = normalizeItemSlug(item.slug || name);
  return {
    ...item,
    name,
    slug,
    rules_era: item.rules_era || ITEM_RULES_ERA_2014,
  };
}

export function is2014Item(item = {}) {
  return String(item.rules_era || '').trim() === ITEM_RULES_ERA_2014;
}
