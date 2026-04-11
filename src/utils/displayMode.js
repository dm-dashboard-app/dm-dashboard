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

export function parseDisplayModeFromLogDetail(detail) {
  if (!detail) return null;
  const raw = String(detail);
  const explicitMatch = raw.match(/mode\s*:\s*(in_combat|out_of_combat|in-combat|out-of-combat)/i);
  if (explicitMatch) return normalizeDisplayMode(explicitMatch[1]);
  return normalizeDisplayMode(raw);
}

export function readDisplayModeFromEncounter(encounter) {
  if (!encounter || typeof encounter !== 'object') return null;
  return normalizeDisplayMode(encounter.display_mode ?? encounter.displayMode ?? null);
}

export async function readDisplayMode(encounterId, options = {}) {
  const encounterMode = readDisplayModeFromEncounter(options.encounter);
  if (encounterMode) return encounterMode;
  if (!encounterId) return normalizeDisplayMode(options.fallback) || DISPLAY_MODE_OUT_OF_COMBAT;

  const { data, error } = await supabase
    .from('combat_log')
    .select('id, detail, created_at')
    .eq('encounter_id', encounterId)
    .eq('action', 'display_mode')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return normalizeDisplayMode(options.fallback) || DISPLAY_MODE_OUT_OF_COMBAT;
  return parseDisplayModeFromLogDetail(data?.detail) || normalizeDisplayMode(options.fallback) || DISPLAY_MODE_OUT_OF_COMBAT;
}

export async function writeDisplayMode(encounterId, mode, source = 'manual') {
  const normalized = normalizeDisplayMode(mode) || DISPLAY_MODE_OUT_OF_COMBAT;
  if (!encounterId) return normalized;

  const encounterUpdate = await supabase
    .from('encounters')
    .update({ display_mode: normalized })
    .eq('id', encounterId);

  if (encounterUpdate?.error) {
    // keep log persistence as a fallback path for older schemas
  }

  await supabase.from('combat_log').insert({
    encounter_id: encounterId,
    actor: 'DM',
    action: 'display_mode',
    detail: `mode:${normalized};source:${source}`,
  });

  return normalized;
}
