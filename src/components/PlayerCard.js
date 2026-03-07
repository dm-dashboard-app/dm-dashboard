import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ConditionChipRow from './ConditionChipRow';
import SpellSlotGrid from './SpellSlotGrid';
import WildShapeBlock from './WildShapeBlock';

export default function PlayerCard({ combatant, state, role, isEditMode, encounterId, onUpdate }) {
  const profile = state?.profiles_players;
  const canEdit = role === 'dm' || role === 'player';
  const readOnly = role === 'display';
  const canRestore = role === 'dm';
  const isPlayer = role === 'player';

  const [localHp, setLocalHp] = useState(null);

  const dbHp = state?.current_hp ?? combatant?.hp_current ?? 0;
  const hp = localHp !== null ? localHp : dbHp;
  // max_hp_override lets DM raise max above profile max mid-session (e.g. Aid spell)
  const effectiveMax = state?.max_hp_override ?? profile?.max_hp ?? combatant?.hp_max ?? 1;
  const tempHp = state?.temp_hp ?? 0;
  const hpPercent = Math.max(0, Math.min(100, (hp / effectiveMax) * 100));
  const concentration = state?.concentration ?? false;
  const reactionUsed = state?.reaction_used ?? false;

  useEffect(() => { setLocalHp(null); }, [dbHp]);

  function hpColor(pct) {
    if (pct > 50) return 'var(--hp-high)';
    if (pct > 25) return 'var(--hp-mid)';
    return 'var(--hp-low)';
  }

  async function syncUnconsciousCondition(newHp, currentConditions) {
    if (!state) return;
    const conditions = currentConditions || state.conditions || [];
    const hasUnc = conditions.includes('UNC');
    if (newHp === 0 && !hasUnc) {
      await supabase.from('player_encounter_state').update({ conditions: [...conditions, 'UNC'] }).eq('id', state.id);
    } else if (newHp > 0 && hasUnc) {
      await supabase.from('player_encounter_state').update({ conditions: conditions.filter(c => c !== 'UNC') }).eq('id', state.id);
    }
  }

  async function adjustHp(delta) {
    if (!state || readOnly) return;
    if (delta < 0 && tempHp > 0) {
      const newTemp = Math.max(0, tempHp + delta);
      await supabase.from('player_encounter_state').update({ temp_hp: newTemp }).eq('id', state.id);
      onUpdate();
      return;
    }
    const newHp = Math.max(0, Math.min(effectiveMax, hp + delta));
    setLocalHp(newHp);
    await supabase.from('player_encounter_state').update({ current_hp: newHp }).eq('id', state.id);
    await syncUnconsciousCondition(newHp, state.conditions);
    onUpdate();
  }

  async function setHpDirect(val) {
    if (!state || readOnly) return;
    const newHp = Math.max(0, Math.min(effectiveMax, parseInt(val) || 0));
    setLocalHp(newHp);
    await supabase.from('player_encounter_state').update({ current_hp: newHp }).eq('id', state.id);
    await syncUnconsciousCondition(newHp, state.conditions);
    onUpdate();
  }

  async function setTempHpDirect(val) {
    if (!state || readOnly) return;
    const newTemp = Math.max(0, parseInt(val) || 0);
    await supabase.from('player_encounter_state').update({ temp_hp: newTemp }).eq('id', state.id);
    onUpdate();
  }

  // DM only — raise/lower session max HP without editing the profile
  async function adjustMaxHp(delta) {
    if (!state || !canRestore) return;
    const profileMax = profile?.max_hp ?? 1;
    const current = state.max_hp_override ?? profileMax;
    const newMax = Math.max(1, current + delta);
    // If it falls back to profile max, clear the override
    const override = newMax === profileMax ? null : newMax;
    await supabase.from('player_encounter_state').update({ max_hp_override: override }).eq('id', state.id);
    onUpdate();
  }

  async function resetMaxHp() {
    if (!state || !canRestore) return;
    await supabase.from('player_encounter_state').update({ max_hp_override: null }).eq('id', state.id);
    onUpdate();
  }

  async function toggleReaction() {
    if (readOnly || !state) return;
    await supabase.from('player_encounter_state').update({ reaction_used: !reactionUsed }).eq('id', state.id);
    onUpdate();
  }

  async function toggleConcentration() {
    if (readOnly || !state) return;
    await supabase.from('player_encounter_state').update({ concentration: !concentration }).eq('id', state.id);
    onUpdate();
  }

  const initials = (combatant?.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="player-card">
      <div className="portrait-strip">
        {profile?.portrait_url ? (
          <img src={profile.portrait_url} alt={combatant.name} className="portrait-img" />
        ) : (
          <div className="portrait-placeholder">
            <span className="portrait-initials">{initials}</span>
          </div>
        )}
      </div>

      <div className="card-body">
        {/* Header */}
        <div className="card-header-row">
          <span className="card-name">{combatant?.name}</span>
          <div className="card-header-badges">
            {isPlayer ? (
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: '2px 7px', opacity: reactionUsed ? 0.35 : 1, borderColor: reactionUsed ? 'var(--border)' : 'var(--accent-gold)', color: reactionUsed ? 'var(--text-muted)' : 'var(--accent-gold)' }}
                onClick={toggleReaction}
                title={reactionUsed ? 'Reaction used' : 'Use Reaction'}
              >⚡ {reactionUsed ? 'Used' : 'React'}</button>
            ) : (
              <button className={`reaction-badge ${reactionUsed ? 'used' : 'available'}`} onClick={canEdit ? toggleReaction : undefined} disabled={readOnly} title="Reaction">⚡</button>
            )}
          </div>
        </div>

        {/* HP Bar */}
        <div className="hp-bar-wrap">
          <div className="hp-bar-track">
            <div className="hp-bar-fill" style={{ width: `${hpPercent}%`, background: hpColor(hpPercent) }} />
            {tempHp > 0 && (
              <div className="hp-bar-temp" style={{ left: `${hpPercent}%`, width: `${Math.min(100 - hpPercent, (tempHp / effectiveMax) * 100)}%` }} />
            )}
          </div>
          <div className="hp-controls">
            {canEdit && !readOnly ? (
              <>
                <button className="btn btn-icon btn-danger" onClick={() => adjustHp(-1)}>−</button>
                <HpInput value={hp} max={effectiveMax} onChange={setHpDirect} />
                <button className="btn btn-icon btn-success" onClick={() => adjustHp(1)}>+</button>
                <span className="hp-max-label">
                  / {effectiveMax}
                  {state?.max_hp_override != null && <span style={{ color: 'var(--accent-gold)', marginLeft: 2 }}>✦</span>}
                </span>
                <TempHpControl tempHp={tempHp} onSet={setTempHpDirect} />
              </>
            ) : (
              <>
                <span className="hp-value">{hp} <span className="hp-max-label">/ {effectiveMax}</span></span>
                {tempHp > 0 && <span className="temp-hp-label">+{tempHp} tmp</span>}
              </>
            )}
          </div>

          {/* DM max HP override — shown below HP controls, DM only */}
          {canRestore && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Max HP:</span>
              <button className="exh-btn" onClick={() => adjustMaxHp(-1)}>−</button>
              <span style={{
                fontSize: 12, fontWeight: 700,
                color: state?.max_hp_override != null ? 'var(--accent-gold)' : 'var(--text-muted)',
              }}>{effectiveMax}</span>
              <button className="exh-btn" onClick={() => adjustMaxHp(1)}>+</button>
              {state?.max_hp_override != null && (
                <button className="slots-reset-btn" onClick={resetMaxHp} title="Reset to profile max">↺</button>
              )}
            </div>
          )}
        </div>

        {/* Core stats */}
        <div className="stats-row">
          <StatPill label="AC" value={profile?.ac ?? combatant?.ac ?? '—'} />
          {profile?.spell_save_dc > 0 && <StatPill label="Spell DC" value={profile.spell_save_dc} />}
          {!!profile?.spell_attack_bonus && <StatPill label="Spell ATK" value={`+${profile.spell_attack_bonus}`} />}
        </div>

        {/* Saves */}
        {profile && (
          <div className="saves-grid">
            {['str','dex','con','int','wis','cha'].map(s => (
              <div key={s} className="save-cell">
                <span className="save-label">{s.toUpperCase()}</span>
                <span className="save-value">{formatMod(profile[`save_${s}`])}</span>
              </div>
            ))}
          </div>
        )}

        {/* Spell slots */}
        {profile && (
          <SpellSlotGrid profile={profile} state={state} readOnly={readOnly} canRestore={canRestore} onUpdate={onUpdate} />
        )}

        {/* Conditions */}
        <ConditionChipRow
          conditions={state?.conditions || []}
          concentration={concentration}
          stateId={state?.id}
          readOnly={readOnly}
          onUpdate={onUpdate}
        />

        {/* Concentration toggle */}
        {!readOnly && (
          <button
            onClick={toggleConcentration}
            style={{ alignSelf: 'flex-start', fontSize: 11, padding: '3px 9px', borderRadius: 'var(--radius-sm)', border: `1px solid ${concentration ? 'var(--accent-gold)' : 'var(--border-strong)'}`, background: concentration ? '#3a2e00' : 'var(--bg-panel-3)', color: concentration ? 'var(--accent-gold)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
            title={concentration ? 'End Concentration' : 'Start Concentration'}
          >🔮 {concentration ? 'Concentrating' : 'Concentration'}</button>
        )}

        {readOnly && concentration && <span className="condition-chip condition-chip-con">CON</span>}

        {/* Wild Shape */}
        {profile?.wildshape_enabled && state && (
          <WildShapeBlock state={state} readOnly={readOnly} canRestore={canRestore} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
}

function TempHpControl({ tempHp, onSet }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(tempHp));

  useEffect(() => { if (!editing) setDraft(String(tempHp)); }, [tempHp, editing]);

  if (!editing) {
    return (
      <span className="temp-hp-label hp-editable" onClick={() => { setDraft(String(tempHp)); setEditing(true); }} title="Set temp HP">
        {tempHp > 0 ? `+${tempHp} tmp` : '+TMP'}
      </span>
    );
  }
  return (
    <input className="hp-inline-input" type="number" value={draft} min={0} autoFocus style={{ width: 48 }}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { onSet(draft); setEditing(false); }}
      onKeyDown={e => { if (e.key === 'Enter') { onSet(draft); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
    />
  );
}

function HpInput({ value, max, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => { if (!editing) setDraft(String(value)); }, [value, editing]);

  if (!editing) {
    return (
      <span className="hp-value hp-editable" onClick={() => { setDraft(String(value)); setEditing(true); }}>{value}</span>
    );
  }
  return (
    <input className="hp-inline-input" type="number" value={draft} min={0} max={max} autoFocus
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { onChange(draft); setEditing(false); }}
      onKeyDown={e => { if (e.key === 'Enter') { onChange(draft); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
    />
  );
}

function StatPill({ label, value }) {
  return (
    <div className="stat-pill">
      <span className="stat-pill-label">{label}</span>
      <span className="stat-pill-value">{value}</span>
    </div>
  );
}

function formatMod(val) {
  if (val === undefined || val === null) return '—';
  return val >= 0 ? `+${val}` : `${val}`;
}