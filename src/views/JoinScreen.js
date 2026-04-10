import React, { useState } from 'react';
import { supabase, signInDM } from '../supabaseClient';

export default function JoinScreen({ onRoleSet }) {
  const [mode, setMode] = useState('choose');

  if (mode === 'choose') return <ChooseMode setMode={setMode} />;
  if (mode === 'dm')      return <DMLogin setMode={setMode} onRoleSet={onRoleSet} />;
  if (mode === 'player')  return <PlayerJoin setMode={setMode} onRoleSet={onRoleSet} />;
  if (mode === 'display') return <DisplayJoin setMode={setMode} onRoleSet={onRoleSet} />;
}

function ChooseMode({ setMode }) {
  return (
    <div className="join-screen join-screen--front">
      <h1 className="join-title join-title--hero">Aurelium</h1>
      <div className="join-options join-options--hero">
        <button className="btn btn-primary btn-lg join-front-btn" onClick={() => setMode('dm')}>Dungeon Master</button>
        <button className="btn btn-ghost btn-lg join-front-btn" onClick={() => setMode('player')}>Player</button>
        <button className="btn btn-ghost btn-lg join-front-btn" onClick={() => setMode('display')}>Display</button>
      </div>
    </div>
  );
}

function DMLogin({ setMode, onRoleSet }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      await signInDM(email, password);
      onRoleSet('dm');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="join-screen">
      <button className="join-back" onClick={() => setMode('choose')}>← Back</button>
      <h1 className="join-title">DM Login</h1>
      <div className="join-form">
        {error && <div className="join-error">{error}</div>}
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="your@email.com" autoComplete="email" />
        </div>
        <div className="form-group">
          <label className="form-label">Password</label>
          <input className="form-input" type="password" value={password}
            onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
        </div>
        <button className="btn btn-primary btn-lg" onClick={handleLogin}
          disabled={loading || !email || !password}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </div>
    </div>
  );
}

function PlayerJoin({ setMode, onRoleSet }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleJoin() {
    setLoading(true);
    setError(null);
    try {
      const upperCode = code.trim().toUpperCase();

      const { data, error: dbError } = await supabase
        .from('player_sessions')
        .select('id, player_profile_id, encounter_id')
        .eq('join_code', upperCode)
        .maybeSingle();

      if (dbError) throw new Error(dbError.message);
      if (!data) throw new Error('Invalid join code. Check with your DM.');

      localStorage.setItem('player_join_code', upperCode);
      localStorage.setItem('player_profile_id', data.player_profile_id);
      localStorage.setItem('player_encounter_id', data.encounter_id);
      onRoleSet('player');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="join-screen">
      <button className="join-back" onClick={() => setMode('choose')}>← Back</button>
      <h1 className="join-title">Player Join</h1>
      <p className="join-sub">Enter the 4-character code your DM sent you</p>
      <div className="join-form">
        {error && <div className="join-error">{error}</div>}
        <input
          className="form-input join-code-input"
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="AB3K"
          maxLength={4}
          autoComplete="off"
          autoCapitalize="characters"
        />
        <button className="btn btn-primary btn-lg" onClick={handleJoin}
          disabled={loading || code.length < 4}>
          {loading ? 'Joining…' : 'Join Session'}
        </button>
      </div>
    </div>
  );
}

function DisplayJoin({ setMode, onRoleSet }) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleJoin() {
    setLoading(true);
    setError(null);
    try {
      const upperToken = token.trim().toUpperCase();

      const { data, error: dbError } = await supabase
        .from('display_sessions')
        .select('id, encounter_id')
        .eq('token', upperToken)
        .maybeSingle();

      if (dbError) throw new Error(dbError.message);
      if (!data) throw new Error('Invalid display token. Ask your DM to generate one.');

      localStorage.setItem('display_token', upperToken);
      localStorage.setItem('display_encounter_id', data.encounter_id);
      onRoleSet('display');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="join-screen">
      <button className="join-back" onClick={() => setMode('choose')}>← Back</button>
      <h1 className="join-title">Display Screen</h1>
      <p className="join-sub">Enter the display token from your DM</p>
      <div className="join-form">
        {error && <div className="join-error">{error}</div>}
        <input className="form-input join-code-input" type="text" value={token}
          onChange={e => setToken(e.target.value.toUpperCase())}
          placeholder="ABC123XYZ789" maxLength={12} autoComplete="off" autoCapitalize="characters" />
        <button className="btn btn-primary btn-lg" onClick={handleJoin}
          disabled={loading || token.length < 4}>
          {loading ? 'Connecting…' : 'Connect Display'}
        </button>
      </div>
    </div>
  );
}
