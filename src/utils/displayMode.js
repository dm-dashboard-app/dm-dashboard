import { supabase } from '../supabaseClient';

export const DISPLAY_MODE_IN_COMBAT = 'in_combat';
export const DISPLAY_MODE_OUT_OF_COMBAT = 'out_of_combat';

function normalizeMode(value) {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === DISPLAY_MODE_IN_COMBAT || normalized === 'in-combat') return DISPLAY_MODE_IN_COMBAT;
  if (normalized === DISPLAY_MODE_OUT_OF_COMBAT || normalized === 'out-of-combat') return DISPLAY_MODE_OUT_OF_COMBAT;
  return null;
}

function parseModeFromDetail(detail) {
  if (!detail) return null;
  const raw = String(detail);
  const explicitMatch = raw.match(/mode\s*:\s*(in_combat|out_of_combat|in-combat|out-of-combat)/i);
  if (explicitMatch) return normalizeMode(explicitMatch[1]);
  return normalizeMode(raw);
}

export async function readDisplayMode(encounterId) {
  if (!encounterId) return DISPLAY_MODE_OUT_OF_COMBAT;
  const { data } = await supabase
    .from('combat_log')
    .select('detail, created_at')
    .eq('encounter_id', encounterId)
    .eq('action', 'display_mode')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return parseModeFromDetail(data?.detail) || DISPLAY_MODE_OUT_OF_COMBAT;
}

export async function writeDisplayMode(encounterId, mode, source = 'manual') {
  const normalized = normalizeMode(mode) || DISPLAY_MODE_OUT_OF_COMBAT;
  if (!encounterId) return;
  await supabase.from('combat_log').insert({
    encounter_id: encounterId,
    actor: 'DM',
    action: 'display_mode',
    detail: `mode:${normalized};source:${source}`,
  });
}
