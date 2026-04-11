import { supabase } from '../supabaseClient';

export const DISPLAY_MODE_IN_COMBAT = 'in_combat';
export const DISPLAY_MODE_OUT_OF_COMBAT = 'out_of_combat';

export function normalizeDisplayMode(value) {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === DISPLAY_MODE_IN_COMBAT || normalized === 'in-combat') return DISPLAY_MODE_IN_COMBAT;
  if (normalized === DISPLAY_MODE_OUT_OF_COMBAT || normalized === 'out-of-combat') return DISPLAY_MODE_OUT_OF_COMBAT;
  return null;
}

export function readDisplayModeFromEncounter(encounter, { logMissing = false } = {}) {
  const mode = normalizeDisplayMode(encounter?.display_mode ?? encounter?.displayMode ?? null);
  if (!mode && logMissing) {
    console.warn('Display mode missing or invalid on encounter payload. Expected encounters.display_mode.');
  }
  return mode || DISPLAY_MODE_OUT_OF_COMBAT;
}

export async function writeDisplayMode(encounterId, mode, source = 'manual') {
  const normalized = normalizeDisplayMode(mode) || DISPLAY_MODE_OUT_OF_COMBAT;
  if (!encounterId) return normalized;

  const { error } = await supabase
    .from('encounters')
    .update({ display_mode: normalized })
    .eq('id', encounterId);

  if (error) {
    console.error('Failed to persist encounters.display_mode.', { encounterId, mode: normalized, source, error });
  }

  return normalized;
}
