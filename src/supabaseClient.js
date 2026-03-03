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
// AUTH HELPERS
// ============================================================

export async function signInDM(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ============================================================
// JOIN CODE / DISPLAY TOKEN HELPERS
// ============================================================

// Player joins via join code — stores code in localStorage for session
export function joinAsPlayer(joinCode) {
  localStorage.setItem('player_join_code', joinCode);
}

export function getPlayerJoinCode() {
  return localStorage.getItem('player_join_code');
}

export function clearPlayerSession() {
  localStorage.removeItem('player_join_code');
  localStorage.removeItem('display_token');
}

// Display joins via display token
export function joinAsDisplay(token) {
  localStorage.setItem('display_token', token);
}

export function getDisplayToken() {
  return localStorage.getItem('display_token');
}

// ============================================================
// ROLE DETECTION
// Returns: 'dm' | 'player' | 'display' | null
// ============================================================
export async function detectRole() {
  const user = await getCurrentUser();
  if (user) return 'dm';
  if (localStorage.getItem('display_token')) return 'display';
  if (localStorage.getItem('player_join_code')) return 'player';
  return null;
}