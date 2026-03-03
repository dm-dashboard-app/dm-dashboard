import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    async function init() {
      try {
        const detectedRole = await detectRole();
        setRole(detectedRole);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    init();

    // Listen for auth changes (DM login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async () => {
      const detectedRole = await detectRole();
      setRole(detectedRole);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <SplashScreen />;
  if (error) return <ErrorScreen message={error} />;

  // Route by role
  if (role === 'dm') return <DMView />;
  if (role === 'player') return <PlayerView />;
  if (role === 'display') return <DisplayView />;

  // No role — show join screen (handles both player code entry and DM login)
  return <JoinScreen onRoleSet={setRole} />;
}

function SplashScreen() {
  return (
    <div className="splash">
      <div className="splash-logo">⚔</div>
      <div className="splash-text">DM Dashboard</div>
    </div>
  );
}

function ErrorScreen({ message }) {
  return (
    <div className="splash">
      <div className="splash-logo">⚠</div>
      <div className="splash-text">Something went wrong</div>
      <div className="splash-sub">{message}</div>
    </div>
  );
}