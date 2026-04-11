import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file or Vercel settings.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

const WORLD_MAP_BUCKET_CANDIDATES = ['world_maps', 'world-maps'];

// ============================================================
// TIMEOUT HELPER
// ============================================================
function withTimeout(promise, ms = 4000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    ),
  ]);
}

// ============================================================
// AUTH HELPERS
// ============================================================

export async function signInDM(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  // Cache DM role so wake-from-sleep never needs a network call
  localStorage.setItem('dm_session', '1');
  return data;
}

export async function signOut() {
  // Clear everything including DM cache before signing out
  localStorage.clear();
  await supabase.auth.signOut();
  window.location.reload();
}

export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
}

export function clearPlayerSession() {
  localStorage.removeItem('player_join_code');
  localStorage.removeItem('player_profile_id');
  localStorage.removeItem('player_encounter_id');
  localStorage.removeItem('display_token');
  localStorage.removeItem('display_encounter_id');
}

export function joinAsPlayer(joinCode) {
  localStorage.setItem('player_join_code', joinCode);
}

export function getPlayerJoinCode() {
  return localStorage.getItem('player_join_code');
}

export function joinAsDisplay(token) {
  localStorage.setItem('display_token', token);
}

export function getDisplayToken() {
  return localStorage.getItem('display_token');
}

// ============================================================
// ROLE DETECTION — fully localStorage-first, no network on wake
// ============================================================
export async function detectRole() {
  // All three roles detectable from localStorage — instant, no network needed
  if (localStorage.getItem('dm_session')) return 'dm';
  if (localStorage.getItem('display_token')) return 'display';
  if (localStorage.getItem('player_join_code')) return 'player';

  // First-time load only — nothing cached yet, check network once
  try {
    const { data: { session } } = await withTimeout(
      supabase.auth.getSession(),
      4000
    );
    if (session?.user) {
      localStorage.setItem('dm_session', '1');
      return 'dm';
    }
  } catch (e) {
    console.warn('Session check timed out or failed:', e.message);
  }

  return null;
}

// ============================================================
// PORTRAIT UPLOAD
// ============================================================
export async function uploadPortrait(file, playerName) {
  const ext = file.name.split('.').pop();
  const filename = `${playerName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('portraits')
    .upload(filename, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('portraits').getPublicUrl(filename);
  return data.publicUrl;
}

export async function uploadWorldMap(file, encounterName = 'encounter') {
  const ext = file.name.split('.').pop();
  const slug = encounterName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const filename = `${slug || 'encounter'}-world-map-${Date.now()}.${ext}`;
  let lastError = null;

  for (const bucket of WORLD_MAP_BUCKET_CANDIDATES) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filename, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
      return data.publicUrl;
    }
    lastError = error;
  }

  throw lastError || new Error('World map upload failed.');
}

export async function removeStoragePublicUrl(bucket, publicUrl) {
  if (!publicUrl) return;
  let bucketName = bucket;
  let path = null;

  try {
    const parsed = new URL(publicUrl);
    const marker = '/storage/v1/object/public/';
    const markerIdx = parsed.pathname.indexOf(marker);
    if (markerIdx !== -1) {
      const bucketPath = parsed.pathname.slice(markerIdx + marker.length);
      const firstSlash = bucketPath.indexOf('/');
      if (firstSlash !== -1) {
        bucketName = decodeURIComponent(bucketPath.slice(0, firstSlash)) || bucketName;
        path = decodeURIComponent(bucketPath.slice(firstSlash + 1));
      }
    }
  } catch (_) {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx !== -1) path = decodeURIComponent(publicUrl.slice(idx + marker.length));
  }

  if (!path) return;
  await supabase.storage.from(bucketName).remove([path]);
}
