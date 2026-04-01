export function flattenStates(data) {
  return (data || []).map(s => ({
    ...s,
    wildshape_form_name: s.profiles_wildshape?.form_name ?? null,
    wildshape_hp_max: s.profiles_wildshape?.hp_max ?? null,
  }));
}

export function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}
