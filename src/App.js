import React, { useState, useEffect, useCallback, useRef } from 'react';
import { detectRole } from './supabaseClient';
import DMView from './views/DMView';
import PlayerView from './views/PlayerView';
import DisplayView from './views/DisplayView';
import LoginScreen from './views/LoginScreen';
import JoinScreen from './views/JoinScreen';
import './App.css';

export default function App() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const roleRef = useRef(null);

  // Keep ref in sync so the visibility handler never reads a stale closure
  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  const init = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detectedRole = await detectRole();
      setRole(detectedRole);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    init();

    // On wake, only re-init if we have no role yet (first load or after sign-out)
    // If role is already set, polling in each view handles data refresh
    function handleVisibility() {
      if (document.visibilityState === 'visible' && roleRef.current === null) {
        init();
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [init]);

  // Note: onAuthStateChange deliberately removed — Supabase fires SIGNED_OUT
  // on token refresh failures during wake, which was causing phantom logouts.
  // Role is now fully managed via localStorage. signOut() clears it explicitly.

  if (loading) return <SplashScreen onRetry={init} />;
  if (error) return <ErrorScreen message={error} onRetry={init} />;

  if (role === 'dm') return <DMView />;
  if (role === 'player') return <PlayerView />;
  if (role === 'display') return <DisplayView />;

  return <JoinScreen onRoleSet={setRole} />;
}

function SplashScreen({ onRetry }) {
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowRetry(true), 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="splash">
      <div className="splash-logo">⚔</div>
      <div className="splash-text">DM Dashboard</div>
      {showRetry && (
        <>
          <div className="splash-sub">Taking too long…</div>
          <button className="btn btn-ghost" onClick={onRetry}>Tap to Retry</button>
        </>
      )}
    </div>
  );
}

function ErrorScreen({ message, onRetry }) {
  return (
    <div className="splash">
      <div className="splash-logo">⚠</div>
      <div className="splash-text">Something went wrong</div>
      <div className="splash-sub">{message}</div>
      <button className="btn btn-ghost" onClick={onRetry}>Retry</button>
    </div>
  );
}