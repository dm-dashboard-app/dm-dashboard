export function flattenEncounterStates(data) {
  return (data || []).map(state => ({
    ...state,
    wildshape_form_name: state.profiles_wildshape?.form_name ?? null,
    wildshape_hp_max: state.profiles_wildshape?.hp_max ?? null,
  }));
}
