import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import ConditionChipRow from './ConditionChipRow';
import SpellSlotGrid from './SpellSlotGrid';
import WildShapeBlock from './WildShapeBlock';

function nextZeroHpConditions(newHp, conditions = []) {
  const next = [...conditions];
  if (newHp === 0) {
    if (!next.includes('UNC')) next.push('UNC');
    if (!next.includes('PRN')) next.push('PRN');
    return next;
  }
  if (newHp > 0) {
    return next.filter(c => c !== 'UNC');
  }
  return next;
}

export default function PlayerCard({ combatant, state, role, isEditMode, encounterId, onUpdate }) {
  const profile = state?.profiles_players;
  const canEdit = role === 'dm' || role === 'player';
  const readOnly = role === 'display';
  const canRestore = role === 'dm';
  const isPlayer = role === 'player';

  const [localHp, setLocalHp] = useState(null);

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

  // CON check DC — read from DB, persistent until confirmed
  // Only show when player is concentrating (if they're not, there's nothing to check)
  const pendingConDc = concentration ? (state?.concentration_check_dc ?? null) : null;

  // Passive perception = 10 + perception skill modifier
  const passivePerception = profile ? (10 + (profile.skill_perception ?? 0)) : null;

  useEffect(() => { setLocalHp(null); }, [dbHp]);

  function hpColor(pct) {
    if (pct > 50) return 'var(--hp-high)';
    if (pct > 25) return 'var(--hp-mid)';
    return 'var(--hp-low)';
  }

  async function syncZeroHpConditions(newHp, currentConditions) {
    if (!state) return;
    const baseConditions = currentConditions || state.conditions || [];
    const updatedConditions = nextZeroHpConditions(newHp, baseConditions);
    await supabase.from('player_encounter_state').update({ conditions: updatedConditions }).eq('id', state.id);
  }

  async function applyDamage(amount) {
    if (!state || readOnly || !amount || amount <= 0) return;

    // If concentrating, write DC to DB for persistent player banner
    if (concentration) {
      const dc = Math.max(10, Math.floor(amount / 2));
      await supabase.from('player_encounter_state').update({ concentration_check_dc: dc }).eq('id', state.id);
      // Log the check
      const playerName = profile?.name || combatant?.name || 'PC';
      supabase.from('concentration_checks').insert({
        encounter_id: encounterId,
        player_name: playerName,
        dc,
      }).then(() => {});
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
      const updatedConditions = nextZeroHpConditions(newHp, state.conditions || []);
      setLocalHp(newHp);
      updates.current_hp = newHp;
      updates.conditions = updatedConditions;
      await supabase.from('player_encounter_state').update(updates).eq('id', state.id);
      // Combat log
      const actor = isPlayer ? (profile?.name || 'Player') : 'DM';
      supabase.from('combat_log').insert({
        encounter_id: encounterId,
        actor,
        action: 'damage',
        detail: `${combatant?.name || 'PC'}: -${amount} HP (${hp} → ${newHp})`,
      }).then(() => {});
    } else {
      await supabase.from('player_encounter_state').update(updates).eq('id', state.id);
      const actor = isPlayer ? (profile?.name || 'Player') : 'DM';
      supabase.from('combat_log').insert({
        encounter_id: encounterId,
        actor,
        action: 'damage',
        detail: `${combatant?.name || 'PC'}: -${amount} (temp HP absorbed)`,
      }).then(() => {});
    }
    onUpdate();
  }

  async function applyHeal(amount) {
    if (!state || readOnly || !amount || amount <= 0) return;
    const newHp = Math.min(maxHp, hp + amount);
    const updatedConditions = nextZeroHpConditions(newHp, state.conditions || []);
    setLocalHp(newHp);
    await supabase.from('player_encounter_state').update({
      current_hp: newHp,
      conditions: updatedConditions,
    }).eq('id', state.id);
    const actor = isPlayer ? (profile?.name || 'Player') : 'DM';
    supabase.from('combat_log').insert({
      encounter_id: encounterId,
      actor,
      action: 'heal',
      detail: `${combatant?.name || 'PC'}: +${amount} HP (${hp} → ${newHp})`,
    }).then(() => {});
    onUpdate();
  }

  async function setHpDirect(val) {
    if (!state || readOnly) return;
    const newHp = Math.max(0, Math.min(maxHp, parseInt(val) || 0));
    const updatedConditions = nextZeroHpConditions(newHp, state.conditions || []);
    setLocalHp(newHp);
    await supabase.from('player_encounter_state').update({
      current_hp: newHp,
      conditions: updatedConditions,
    }).eq('id', state.id);
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
    // If turning off concentration, also clear any pending check
    const updates = { concentration: !concentration };
    if (concentration) updates.concentration_check_dc = null;
    await supabase.from('player_encounter_state').update(updates).eq('id', state.id);
    onUpdate();
  }

  // CON check confirmation handlers
  async function handleConPass() {
    if (!state) return;
    // Find the most recent pending check and mark it passed
    const playerName = profile?.name || combatant?.name;
    if (playerName) {
      const { data: checks } = await supabase
        .from('concentration_checks')
        .select('id')
        .eq('encounter_id', encounterId)
        .eq('player_name', playerName)
        .eq('result', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);
      if (checks && checks.length > 0) {
        await supabase.from('concentration_checks').update({ result: 'passed' }).eq('id', checks[0].id);
      }
    }
    await supabase.from('player_encounter_state').update({ concentration_check_dc: null }).eq('id', state.id);
    onUpdate();
  }

  async function handleConFail() {
    if (!state) return;
    // Find the most recent pending check and mark it failed
    const playerName = profile?.name || combatant?.name;
    if (playerName) {
      const { data: checks } = await supabase
        .from('concentration_checks')
        .select('id')
        .eq('encounter_id', encounterId)
        .eq('player_name', playerName)
        .eq('result', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);
      if (checks && checks.length > 0) {
        await supabase.from('concentration_checks').update({ result: 'failed' }).eq('id', checks[0].id);
      }
    }
    // Clear DC and end concentration
    await supabase.from('player_encounter_state').update({
      concentration_check_dc: null,
      concentration: false,
    }).eq('id', state.id);
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
            {/* Reaction pill on player card — prominent, always visible */}
            {canEdit ? (
              <button
                className={`reaction-pill reaction-pill--clickable ${reactionUsed ? 'reaction-pill--used' : 'reaction-pill--ready'}`}
                onClick={toggleReaction}
                title={reactionUsed ? 'Restore reaction' : 'Mark reaction used'}
              >
                ⚡ {reactionUsed ? 'USED' : 'REACT'}
              </button>
            ) : (
              <span className={`reaction-pill ${reactionUsed ? 'reaction-pill--used' : 'reaction-pill--ready'}`} style={{ cursor: 'default' }}>
                ⚡ {reactionUsed ? 'USED' : 'REACT'}
              </span>
            )}
          </div>
        </div>

        {/* CON Save Banner — persistent, DB-driven, player must confirm */}
        {pendingConDc !== null && (
          <div className="con-check-banner">
            <div className="con-check-banner-header">
              <span className="con-check-label">🔮 CONCENTRATION CHECK</span>
              <span className="con-check-dc">DC {pendingConDc}</span>
            </div>
            <div className="con-check-actions">
              <button className="con-check-pass" onClick={handleConPass}>✅ Passed</button>
              <button className="con-check-fail" onClick={handleConFail}>❌ Failed — lose concentration</button>
            </div>
          </div>
        )}

        {/* HP bar */}
        <div style={{ position: 'relative' }}>
          <div className="hp-bar-track" style={{ height: 10 }}>
            <div className="hp-bar-fill" style={{ width: `${hpPercent}%`, background: hpColor(hpPercent) }} />
            {tempHp > 0 && (
              <div className="hp-bar-temp" style={{
                left: `${hpPercent}%`,
                width: `${Math.min(100 - hpPercent, (tempHp / maxHp) * 100)}%`,
              }} />
            )}
          </div>
        </div>

        {/* HP numbers */}
        <div className="hp-numbers-row">
          {!readOnly ? (
            <HpEditableNumber value={hp} onSet={setHpDirect} />
          ) : (
            <span className="hp-value">{hp}</span>
          )}
          <span className="hp-slash">/</span>
          <span className="hp-value" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{maxHp}</span>
          {tempHp > 0 && (
            !readOnly ? (
              <TempHpControl tempHp={tempHp} onSet={setTempHpDirect} />
            ) : (
              <span className="temp-hp-label">+{tempHp} temp</span>
            )
          )}
          {!readOnly && tempHp === 0 && (
            <TempHpControl tempHp={tempHp} onSet={setTempHpDirect} />
          )}
          {maxHpOverride !== null && (
            <span style={{ fontSize: 10, color: 'var(--accent-gold)', marginLeft: 2 }}>✦</span>
          )}
        </div>

        {/* DMG / HEAL widget */}
        {canEdit && (
          <DmgHealRow onDamage={applyDamage} onHeal={applyHeal} />
        )}

        {/* Max HP override (DM only) */}
        {canRestore && (
          <div className="max-hp-override-row">
            <span className="max-hp-override-label">Max HP {maxHpOverride !== null ? '✦' : ''}</span>
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

// ---- Sub-components ----

function StatPill({ label, value }) {
  return (
    <div className="stat-pill">
      <span className="stat-pill-label">{label}</span>
      <span className="stat-pill-value">{value}</span>
    </div>
  );
}

function formatMod(val) {
  const n = parseInt(val);
  if (isNaN(n)) return '—';
  return n >= 0 ? `+${n}` : `${n}`;
}

function HpEditableNumber({ value, onSet }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef(null);

  useEffect(() => { if (!editing) setDraft(String(value)); }, [value, editing]);

  function commit() {
    setEditing(false);
    const n = parseInt(draft);
    if (!isNaN(n) && n !== value) onSet(n);
  }

  if (!editing) {
    return (
      <span className="hp-value hp-editable" onClick={() => { setDraft(String(value)); setEditing(true); setTimeout(() => inputRef.current?.select(), 0); }}>
        {value}
      </span>
    );
  }
  return (
    <input
      ref={inputRef}
      className="hp-inline-input hp-value"
      type="number"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); } }}
      autoFocus
    />
  );
}

function TempHpControl({ tempHp, onSet }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(tempHp));

  useEffect(() => { if (!editing) setDraft(String(tempHp)); }, [tempHp, editing]);

  if (!editing) {
    return (
      <span className="temp-hp-label hp-editable" onClick={() => { setDraft(String(tempHp)); setEditing(true); }} title="Set temp HP">
        {tempHp > 0 ? `+${tempHp} tmp` : '+ tmp'}
      </span>
    );
  }
  return (
    <input
      className="hp-inline-input"
      style={{ width: 48, fontSize: 13 }}
      type="number"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); const n = parseInt(draft); if (!isNaN(n)) onSet(n); }}
      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(false); }}
      autoFocus
    />
  );
}