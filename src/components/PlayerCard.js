import React, { useState, useEffect, useRef } from 'react';
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
  const [conDc, setConDc] = useState(null);
  const conTimer = useRef(null);

  const dbHp = state?.current_hp ?? combatant?.hp_current ?? 0;
  const hp = localHp !== null ? localHp : dbHp;

  const profileMax = profile?.max_hp ?? combatant?.hp_max ?? 1;
  const maxHpOverride = state?.max_hp_override ?? null;
  const maxHp = maxHpOverride !== null ? maxHpOverride : profileMax;

  const tempHp = state?.temp_hp ?? 0;
  const hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const concentration = state?.concentration ?? false;
  const reactionUsed = state?.reaction_used ?? false;
  const isBloodied = hp > 0 && hp <= Math.floor(maxHp / 2);

  // Passive perception = 10 + perception skill modifier
  const passivePerception = profile ? (10 + (profile.skill_perception ?? 0)) : null;

  useEffect(() => { setLocalHp(null); }, [dbHp]);
  useEffect(() => () => clearTimeout(conTimer.current), []);

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

  async function applyDamage(amount) {
    if (!state || readOnly || !amount || amount <= 0) return;
    if (concentration) {
      clearTimeout(conTimer.current);
      setConDc(Math.max(10, Math.floor(amount / 2)));
      conTimer.current = setTimeout(() => setConDc(null), 7000);
    }
    let remaining = amount;
    const updates = {};
    if (tempHp > 0) {
      const burn = Math.min(tempHp, remaining);
      remaining -= burn;
      updates.temp_hp = tempHp - burn;
    }
    if (remaining > 0) {
      const newHp = Math.max(0, hp - remaining);
      setLocalHp(newHp);
      updates.current_hp = newHp;
      await supabase.from('player_encounter_state').update(updates).eq('id', state.id);
      await syncUnconsciousCondition(newHp, state.conditions);
    } else {
      await supabase.from('player_encounter_state').update(updates).eq('id', state.id);
    }
    onUpdate();
  }

  async function applyHeal(amount) {
    if (!state || readOnly || !amount || amount <= 0) return;
    const newHp = Math.min(maxHp, hp + amount);
    setLocalHp(newHp);
    await supabase.from('player_encounter_state').update({ current_hp: newHp }).eq('id', state.id);
    await syncUnconsciousCondition(newHp, state.conditions);
    onUpdate();
  }

  async function setHpDirect(val) {
    if (!state || readOnly) return;
    const newHp = Math.max(0, Math.min(maxHp, parseInt(val) || 0));
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

  async function adjustMaxHp(delta) {
    if (!state || !canRestore) return;
    const newMax = Math.max(1, maxHp + delta);
    const overrideVal = newMax === profileMax ? null : newMax;
    const newHp = Math.min(hp, newMax);
    const updates = { max_hp_override: overrideVal };
    if (newHp !== hp) { updates.current_hp = newHp; setLocalHp(newHp); }
    await supabase.from('player_encounter_state').update(updates).eq('id', state.id);
    onUpdate();
  }

  async function resetMaxHp() {
    if (!state || !canRestore) return;
    const newHp = Math.min(hp, profileMax);
    const updates = { max_hp_override: null };
    if (newHp !== hp) { updates.current_hp = newHp; setLocalHp(newHp); }
    await supabase.from('player_encounter_state').update(updates).eq('id', state.id);
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

  const initials = (combatant?.name || '?')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
            <span className="card-name">{combatant?.name}</span>
            {isBloodied && <span className="badge badge-bloodied">BLOODIED</span>}
          </div>
          <div className="card-header-badges">
            {isPlayer ? (
              <button
                className="btn btn-ghost"
                style={{
                  fontSize: 11, padding: '2px 7px',
                  opacity: reactionUsed ? 0.35 : 1,
                  borderColor: reactionUsed ? 'var(--border)' : 'var(--accent-gold)',
                  color: reactionUsed ? 'var(--text-muted)' : 'var(--accent-gold)',
                }}
                onClick={toggleReaction}
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
        <div className="hp-bar-track" style={{ height: 10, marginTop: 2 }}>
          <div className="hp-bar-fill" style={{ width: `${hpPercent}%`, background: hpColor(hpPercent) }} />
          {tempHp > 0 && (
            <div className="hp-bar-temp" style={{
              left: `${hpPercent}%`,
              width: `${Math.min(100 - hpPercent, (tempHp / maxHp) * 100)}%`
            }} />
          )}
        </div>

        {/* HP Numbers */}
        <div className="hp-numbers-row">
          {canEdit && !readOnly ? (
            <HpInput value={hp} max={maxHp} onChange={setHpDirect} />
          ) : (
            <span className="hp-value">{hp}</span>
          )}
          <span className="hp-slash">/ {maxHp}</span>
          {maxHpOverride !== null && canRestore && (
            <button className="hp-override-badge" onClick={resetMaxHp} title="Reset to profile max">✦ ↺</button>
          )}
          {canEdit && !readOnly ? (
            <TempHpControl tempHp={tempHp} onSet={setTempHpDirect} />
          ) : (
            tempHp > 0 && <span className="temp-hp-label">+{tempHp} tmp</span>
          )}
        </div>

        {/* DMG / HEAL widget */}
        {canEdit && !readOnly && (
          <DmgHealRow onDamage={applyDamage} onHeal={applyHeal} />
        )}

        {/* CON Save Banner */}
        {conDc !== null && (
          <div className="con-check-banner">
            <span className="con-check-label">🔮 CON SAVE</span>
            <span className="con-check-dc">DC {conDc}</span>
          </div>
        )}

        {/* Max HP Override (DM only) */}
        {canRestore && (
          <div className="max-hp-override-row">
            <span className="max-hp-override-label">Max HP{maxHpOverride !== null ? ' ✦' : ''}</span>
            <button className="btn btn-icon btn-ghost" style={{ minWidth: 28, minHeight: 28, fontSize: 13 }} onClick={() => adjustMaxHp(-1)}>−</button>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, minWidth: 28, textAlign: 'center' }}>{maxHp}</span>
            <button className="btn btn-icon btn-ghost" style={{ minWidth: 28, minHeight: 28, fontSize: 13 }} onClick={() => adjustMaxHp(1)}>+</button>
            {maxHpOverride !== null && (
              <button className="btn btn-ghost" style={{ fontSize: 11, padding: '1px 6px' }} onClick={resetMaxHp}>↺ reset</button>
            )}
          </div>
        )}

        {/* Core stats — PP shown after AC */}
        <div className="stats-row">
          <StatPill label="AC" value={profile?.ac ?? combatant?.ac ?? '—'} />
          {passivePerception !== null && <StatPill label="PP" value={passivePerception} />}
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
          concentration={concentration}
          stateId={state?.id}
          readOnly={readOnly}
          onUpdate={onUpdate}
        />

        {/* Concentration toggle */}
        {!readOnly && (
          <button
            onClick={toggleConcentration}
            style={{
              alignSelf: 'flex-start', fontSize: 11, padding: '3px 9px',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${concentration ? 'var(--accent-gold)' : 'var(--border-strong)'}`,
              background: concentration ? '#3a2e00' : 'var(--bg-panel-3)',
              color: concentration ? 'var(--accent-gold)' : 'var(--text-secondary)',
              cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            🔮 {concentration ? 'Concentrating' : 'Concentration'}
          </button>
        )}

        {readOnly && concentration && (
          <span className="condition-chip condition-chip-con">CON</span>
        )}

        {/* Wild Shape */}
        {profile?.wildshape_enabled && state && (
          <WildShapeBlock state={state} readOnly={readOnly} canRestore={canRestore} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// DMG / HEAL WIDGET — exported for use in InitiativePanel
// ============================================================
export function DmgHealRow({ onDamage, onHeal, compact = false }) {
  const [amount, setAmount] = useState('');
  const inputRef = useRef(null);
  const n = parseInt(amount);
  const valid = !isNaN(n) && n > 0;

  function handleDamage() {
    if (!valid) return;
    onDamage(n);
    setAmount('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleHeal() {
    if (!valid) return;
    onHeal(n);
    setAmount('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div className={`hp-dmg-row${compact ? ' hp-dmg-row--compact' : ''}`}>
      <button className="hp-action-btn hp-action-dmg" onClick={handleDamage} disabled={!valid}>⚔ DMG</button>
      <input
        ref={inputRef}
        className={`hp-amount-input${compact ? ' hp-amount-input--compact' : ''}`}
        type="number"
        inputMode="numeric"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') handleDamage();
          if (e.key === 'Escape') setAmount('');
        }}
        placeholder="—"
        min={1}
      />
      <button className="hp-action-btn hp-action-heal" onClick={handleHeal} disabled={!valid}>HEAL ♥</button>
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