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
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// ============================================================
// TIMEOUT HELPER — prevents getSession hanging on mobile wake
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
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
  localStorage.clear();
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
// ROLE DETECTION — fast, with timeout so it never hangs
// ============================================================
export async function detectRole() {
  // Check localStorage first — instant, no network needed
  if (localStorage.getItem('display_token')) return 'display';
  if (localStorage.getItem('player_join_code')) return 'player';

  // Only hit the network for DM session check, with timeout
  try {
    const { data: { session } } = await withTimeout(
      supabase.auth.getSession(),
      4000
    );
    if (session?.user) return 'dm';
  } catch (e) {
    // Timed out or failed — if they had a session it'll recover on next poll
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