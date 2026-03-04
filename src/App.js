import React, { useState, useEffect, useCallback } from 'react';
import { supabase, detectRole, signInDM } from './supabaseClient';
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

    // Listen for auth changes (DM login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async () => {
      const detectedRole = await detectRole();
      setRole(detectedRole);
    });

    // Re-run role detection when phone wakes — recovers DM session after sleep
    function handleVisibility() {
      if (document.visibilityState === 'visible' && loading === false) {
        init();
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [init]);

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
    // If still on splash after 5s, show a tap-to-retry option
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