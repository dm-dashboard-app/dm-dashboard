export function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .replace(/-{2,}/g, '-');
}

export function normalizeName(value = '') {
  return slugify(value);
}

export function parseAttunementFromName(name = '') {
  return /requires\s+attunement/i.test(String(name));
}

export function chunk(items, size = 200) {
  const groups = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}
