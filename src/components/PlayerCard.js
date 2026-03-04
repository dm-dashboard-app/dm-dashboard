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
  const maxHp = profile?.max_hp ?? combatant?.hp_max ?? 1;
  const tempHp = state?.temp_hp ?? 0;
  const hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));

  useEffect(() => {
    setLocalHp(null);
  }, [dbHp]);

  function hpColor(pct) {
    if (pct > 50) return 'var(--hp-high)';
    if (pct > 25) return 'var(--hp-mid)';
    return 'var(--hp-low)';
  }

  async function adjustHp(delta) {
    if (!state || readOnly) return;

    // When taking damage (delta < 0), burn temp HP first
    if (delta < 0 && tempHp > 0) {
      const newTemp = Math.max(0, tempHp + delta);
      await supabase
        .from('player_encounter_state')
        .update({ temp_hp: newTemp })
        .eq('id', state.id);
      onUpdate();
      return;
    }

    const newHp = Math.max(0, Math.min(maxHp, hp + delta));
    setLocalHp(newHp);
    await supabase
      .from('player_encounter_state')
      .update({ current_hp: newHp })
      .eq('id', state.id);
    onUpdate();
  }

  async function setHpDirect(val) {
    if (!state || readOnly) return;
    const newHp = Math.max(0, Math.min(maxHp, parseInt(val) || 0));
    setLocalHp(newHp);
    await supabase
      .from('player_encounter_state')
      .update({ current_hp: newHp })
      .eq('id', state.id);
    onUpdate();
  }

  async function setTempHpDirect(val) {
    if (!state || readOnly) return;
    const newTemp = Math.max(0, parseInt(val) || 0);
    await supabase
      .from('player_encounter_state')
      .update({ temp_hp: newTemp })
      .eq('id', state.id);
    onUpdate();
  }

  async function toggleReaction() {
    if (readOnly || !state) return;
    await supabase
      .from('player_encounter_state')
      .update({ reaction_used: !state.reaction_used })
      .eq('id', state.id);
    onUpdate();
  }

  async function toggleConcentration() {
    if (readOnly || !state) return;
    await supabase
      .from('player_encounter_state')
      .update({ concentration: !state.concentration })
      .eq('id', state.id);
    onUpdate();
  }

  const initials = (combatant?.name || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const reactionUsed = state?.reaction_used ?? false;

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
        <div className="card-header-row">
          <span className="card-name">{combatant?.name}</span>
          <div className="card-header-badges">
            {state?.concentration && (
              <span
                className="condition-chip condition-chip-con"
                onClick={canEdit ? toggleConcentration : undefined}
                style={{ cursor: canEdit ? 'pointer' : 'default' }}
              >CON</span>
            )}

            {isPlayer ? (
              <button
                className="btn btn-ghost"
                style={{
                  fontSize: 11,
                  padding: '2px 7px',
                  opacity: reactionUsed ? 0.35 : 1,
                  borderColor: reactionUsed ? 'var(--border)' : 'var(--accent-gold)',
                  color: reactionUsed ? 'var(--text-muted)' : 'var(--accent-gold)',
                }}
                onClick={toggleReaction}
                title={reactionUsed ? 'Reaction used' : 'Use Reaction'}
              >
                ⚡ {reactionUsed ? 'Used' : 'React'}
              </button>
            ) : (
              <button
                className={`reaction-badge ${reactionUsed ? 'used' : 'available'}`}
                onClick={canEdit ? toggleReaction : undefined}
                disabled={readOnly}
                title="Reaction"
              >⚡</button>
            )}
          </div>
        </div>

        {/* HP Bar */}
        <div className="hp-bar-wrap">
          <div className="hp-bar-track">
            <div
              className="hp-bar-fill"
              style={{ width: `${hpPercent}%`, background: hpColor(hpPercent) }}
            />
            {tempHp > 0 && (
              <div
                className="hp-bar-temp"
                style={{
                  left: `${hpPercent}%`,
                  width: `${Math.min(100 - hpPercent, (tempHp / maxHp) * 100)}%`
                }}
              />
            )}
          </div>
          <div className="hp-controls">
            {canEdit && !readOnly ? (
              <>
                <button className="btn btn-icon btn-danger" onClick={() => adjustHp(-1)}>−</button>
                <HpInput value={hp} max={maxHp} onChange={setHpDirect} />
                <button className="btn btn-icon btn-success" onClick={() => adjustHp(1)}>+</button>
                <span className="hp-max-label">/ {maxHp}</span>
                <TempHpControl tempHp={tempHp} onSet={setTempHpDirect} />
              </>
            ) : (
              <>
                <span className="hp-value">{hp} <span className="hp-max-label">/ {maxHp}</span></span>
                {tempHp > 0 && <span className="temp-hp-label">+{tempHp} tmp</span>}
              </>
            )}
          </div>
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
          <SpellSlotGrid
            profile={profile}
            state={state}
            readOnly={readOnly}
            canRestore={canRestore}
            onUpdate={onUpdate}
          />
        )}

        {/* Conditions */}
        <ConditionChipRow
          conditions={state?.conditions || []}
          concentration={state?.concentration || false}
          stateId={state?.id}
          readOnly={readOnly}
          onUpdate={onUpdate}
        />

        {/* Wild Shape */}
        {profile?.wildshape_enabled && state && (
          <WildShapeBlock
            state={state}
            readOnly={readOnly}
            canRestore={canRestore}
            onUpdate={onUpdate}
          />
        )}
      </div>
    </div>
  );
}

function TempHpControl({ tempHp, onSet }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(tempHp));

  useEffect(() => {
    if (!editing) setDraft(String(tempHp));
  }, [tempHp, editing]);

  if (!editing) {
    return (
      <span
        className="temp-hp-label hp-editable"
        onClick={() => { setDraft(String(tempHp)); setEditing(true); }}
        title="Set temp HP"
      >
        {tempHp > 0 ? `+${tempHp} tmp` : '+TMP'}
      </span>
    );
  }

  return (
    <input
      className="hp-inline-input"
      type="number"
      value={draft}
      min={0}
      autoFocus
      style={{ width: 48 }}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { onSet(draft); setEditing(false); }}
      onKeyDown={e => {
        if (e.key === 'Enter') { onSet(draft); setEditing(false); }
        if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
}

function HpInput({ value, max, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  if (!editing) {
    return (
      <span className="hp-value hp-editable" onClick={() => { setDraft(String(value)); setEditing(true); }}>
        {value}
      </span>
    );
  }

  return (
    <input
      className="hp-inline-input"
      type="number"
      value={draft}
      min={0}
      max={max}
      autoFocus
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { onChange(draft); setEditing(false); }}
      onKeyDown={e => {
        if (e.key === 'Enter') { onChange(draft); setEditing(false); }
        if (e.key === 'Escape') setEditing(false);
      }}
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