import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

// ============================================================
// CONSTANTS
// ============================================================
const CONDITIONS = [
  { code: 'BLD',  label: 'Blinded',       colour: '#6b5b95' },
  { code: 'CHM',  label: 'Charmed',       colour: '#e8a0bf' },
  { code: 'DEF',  label: 'Deafened',      colour: '#888' },
  { code: 'FRG',  label: 'Frightened',    colour: '#9b2335' },
  { code: 'GRP',  label: 'Grappled',      colour: '#8b6914' },
  { code: 'INC',  label: 'Incapacitated', colour: '#b5451b' },
  { code: 'INV',  label: 'Invisible',     colour: '#4a4a7a' },
  { code: 'PAR',  label: 'Paralyzed',     colour: '#7a4a9a' },
  { code: 'PET',  label: 'Petrified',     colour: '#888' },
  { code: 'PSN',  label: 'Poisoned',      colour: '#3a7a3a' },
  { code: 'PRN',  label: 'Prone',         colour: '#7a6030' },
  { code: 'RST',  label: 'Restrained',    colour: '#8b4513' },
  { code: 'STN',  label: 'Stunned',       colour: '#4a4a7a' },
  { code: 'UNC',  label: 'Unconscious',   colour: '#2a2a3a' },
  { code: 'EXH',  label: 'Exhaustion',    colour: '#5a3a7a' },
  { code: 'HEX',  label: 'Hex',           colour: '#6a0dad' },
];

const CONDITION_COLOURS = Object.fromEntries(CONDITIONS.map(c => [c.code, c.colour]));

const DAMAGE_TYPES = [
  'acid','bludgeoning','cold','fire','force','lightning',
  'necrotic','piercing','poison','psychic','radiant','slashing','thunder',
];

const MODS = ['str','dex','con','int','wis','cha'];

// ============================================================
// HELPERS
// ============================================================
function sortCombatants(combatants) {
  return [...combatants].sort((a, b) => {
    const ai = a.initiative_total ?? -999;
    const bi = b.initiative_total ?? -999;
    if (bi !== ai) return bi - ai;
    const am = a.initiative_mod ?? 0;
    const bm = b.initiative_mod ?? 0;
    if (bm !== am) return bm - am;
    return a.id < b.id ? -1 : 1;
  });
}

function logCombat(encounterId, actor, action, detail) {
  if (!encounterId) return;
  supabase.from('combat_log').insert({ encounter_id: encounterId, actor, action, detail }).then(() => {});
}

// ============================================================
// MINI HP BAR
// ============================================================
function MiniHpBar({ current, max, tempHp = 0, color, label }) {
  const pct     = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const tempPct = max > 0 ? Math.max(0, Math.min(100, (tempHp / max) * 100)) : 0;
  const barColor = color || (pct > 50 ? 'var(--hp-high)' : pct > 25 ? 'var(--hp-mid)' : 'var(--hp-low)');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {label && <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>}
      <div style={{ position: 'relative', height: 6, background: 'var(--bg-panel-3)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.3s' }} />
        {tempHp > 0 && (
          <div style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: `${Math.min(tempPct, 100 - pct)}%`, background: 'var(--hp-temp)', opacity: 0.7, borderRadius: 3 }} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// LEGENDARY PIPS
// ============================================================
function LegendaryPips({ label, max, used, isDM, onSpend, onRestore, onReset, isActive }) {
  if (max === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 9, color: 'var(--accent-gold)', fontWeight: 700, width: 16, textTransform: 'uppercase' }}>{label}</span>
      {Array.from({ length: max }).map((_, i) => {
        const isSpent = i < used;
        return (
          <button
            key={i}
            onClick={e => { e.stopPropagation(); if (!isDM) return; isSpent ? onRestore() : onSpend(); }}
            title={isDM ? (isSpent ? 'Restore' : 'Spend') : undefined}
            style={{
              width: 14, height: 14, borderRadius: '50%',
              border: `2px solid var(--accent-gold)`,
              background: isSpent ? 'transparent' : 'var(--accent-gold)',
              cursor: isDM ? 'pointer' : 'default',
              padding: 0, transition: 'background 0.1s',
            }}
          />
        );
      })}
      <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 2 }}>
        {used > 0 ? `${max - used}/${max}` : `${max}/${max}`}
      </span>
      {isDM && isActive && (
        <button
          onClick={onReset}
          title="Reset (start of turn)"
          style={{ fontSize: 11, color: 'var(--accent-gold)', opacity: used === 0 ? 0.2 : 0.7, padding: '0 2px', cursor: used === 0 ? 'default' : 'pointer', background: 'none', border: 'none', transition: 'opacity 0.15s' }}
          disabled={used === 0}
        >↺</button>
      )}
    </div>
  );
}

// ============================================================
// INLINE DMG / HEAL WIDGET
// ============================================================
function InlineDmgHeal({ onDamage, onHeal }) {
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
    <div className="hp-dmg-row hp-dmg-row--compact">
      <button className="hp-action-btn hp-action-dmg" onClick={handleDamage} disabled={!valid}>⚔ DMG</button>
      <input
        ref={inputRef}
        className="hp-amount-input hp-amount-input--compact"
        type="number"
        inputMode="numeric"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleDamage(); if (e.key === 'Escape') setAmount(''); }}
        placeholder="—"
        min={1}
      />
      <button className="hp-action-btn hp-action-heal" onClick={handleHeal} disabled={!valid}>HEAL ♥</button>
    </div>
  );
}

// ============================================================
// ENEMY SPELL SLOT GRID
// ============================================================
function EnemySlotGrid({ combatant, onUpdate }) {
  const levels = [1,2,3,4,5,6,7,8,9];
  const activeLevels = levels.filter(l => (combatant[`slots_max_${l}`] || 0) > 0);
  if (activeLevels.length === 0) return null;

  async function useSlot(level) {
    const used = combatant[`slots_used_${level}`] || 0;
    const max  = combatant[`slots_max_${level}`]  || 0;
    if (used >= max) return;
    await supabase.from('combatants').update({ [`slots_used_${level}`]: used + 1 }).eq('id', combatant.id);
    onUpdate();
  }

  async function restoreSlot(level) {
    const used = combatant[`slots_used_${level}`] || 0;
    if (used <= 0) return;
    await supabase.from('combatants').update({ [`slots_used_${level}`]: used - 1 }).eq('id', combatant.id);
    onUpdate();
  }

  async function resetLevel(level) {
    await supabase.from('combatants').update({ [`slots_used_${level}`]: 0 }).eq('id', combatant.id);
    onUpdate();
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Spell Slots
      </div>
      <div className="slots-grid">
        {activeLevels.map(level => {
          const max  = combatant[`slots_max_${level}`]  || 0;
          const used = combatant[`slots_used_${level}`] || 0;
          const allUsed = used >= max;
          return (
            <div key={level} className="slots-row">
              <span className="slots-label">{level}</span>
              {Array.from({ length: max }).map((_, i) => {
                const isUsed = i < used;
                return (
                  <button
                    key={i}
                    className={`slot-pip ${isUsed ? 'used' : 'available'}`}
                    onClick={() => isUsed ? restoreSlot(level) : useSlot(level)}
                    title={isUsed ? 'Restore slot' : 'Use slot'}
                    style={{ cursor: 'pointer' }}
                  />
                );
              })}
              {used > 0 && (
                <button className="slots-reset-btn" onClick={() => resetLevel(level)} title="Restore all">↺</button>
              )}
              {allUsed && <span className="slots-empty-label">expended</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// MAIN PANEL
// ============================================================
export default function InitiativePanel({ encounter, combatants, playerStates = [], role, onUpdate, myCombatantId = null }) {
  const isDM = role === 'dm';
  const sorted = sortCombatants(combatants);
  const activeTurnIndex = encounter?.turn_index ?? 0;

  return (
    <div className="panel">
      <div className="panel-title">Initiative Order</div>
      <div className="initiative-list">
        {sorted.length === 0 && <div className="empty-state">No combatants yet.</div>}
        {sorted.map((c, idx) => {
          const playerState = playerStates.find(s => s.combatant_id === c.id);
          return (
            <InitiativeRow
              key={c.id}
              combatant={c}
              playerState={playerState}
              isActive={idx === activeTurnIndex}
              isDM={isDM}
              onUpdate={onUpdate}
              sorted={sorted}
              idx={idx}
              encounterId={encounter?.id}
              myCombatantId={myCombatantId}
            />
          );
        })}
      </div>
      {isDM && encounter && (
        <div style={{ marginTop: 12 }}>
          <AddCombatantInline encounterId={encounter.id} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}

// ============================================================
// INITIATIVE ROW
// ============================================================
function InitiativeRow({ combatant, playerState, isActive, isDM, onUpdate, sorted, idx, encounterId, myCombatantId }) {
  const [expanded, setExpanded]           = useState(false);
  const [condPickerOpen, setCondPickerOpen] = useState(false);
  const [resPicker, setResPicker]         = useState(false);
  const [inputValue, setInputValue]       = useState(
    combatant.initiative_total != null ? String(combatant.initiative_total) : ''
  );
  const [conDc, setConDc]   = useState(null);
  const conTimer            = useRef(null);
  const isFocused           = useRef(false);
  const savingRef           = useRef(false);

  useEffect(() => {
    if (!isFocused.current) {
      setInputValue(combatant.initiative_total != null ? String(combatant.initiative_total) : '');
    }
  }, [combatant.initiative_total]);

  useEffect(() => () => clearTimeout(conTimer.current), []);

  const isPC    = combatant.side === 'PC';
  const isEnemy = combatant.side === 'ENEMY' || combatant.side === 'NPC';
  const conditions = combatant.conditions || [];

  // PC state
  const pcHpCurrent   = playerState?.current_hp ?? null;
  const pcProfileMax  = playerState?.profiles_players?.max_hp ?? null;
  const pcMaxOverride = playerState?.max_hp_override ?? null;
  const pcHpMax       = pcMaxOverride !== null ? pcMaxOverride : pcProfileMax;
  const tempHp        = playerState?.temp_hp ?? 0;
  const concentration = playerState?.concentration ?? false;
  const reactionUsed  = playerState?.reaction_used ?? false;
  const pcConditions  = playerState?.conditions || [];
  const displayConditions = isPC ? pcConditions : conditions;

  const passivePerception = isPC && playerState?.profiles_players
    ? (10 + (playerState.profiles_players.skill_perception ?? 0))
    : null;

  const wsActive    = playerState?.wildshape_active ?? false;
  const wsHpCurrent = playerState?.wildshape_hp_current ?? 0;
  const wsFormName  = playerState?.wildshape_form_name ?? null;
  const wsHpMax     = playerState?.wildshape_hp_max ?? null;

  const enemyHpCurrent    = combatant.hp_current ?? null;
  const enemyHpMax        = combatant.hp_max ?? null;
  const enemyReactionUsed = combatant.reaction_used ?? false;

  const showPcHp    = isPC && pcHpCurrent !== null && pcHpMax !== null;
  const showEnemyHp = isEnemy && isDM && enemyHpCurrent !== null && enemyHpMax !== null;

  const pcBloodied    = isPC && pcHpCurrent !== null && pcHpMax !== null && pcHpCurrent > 0 && pcHpCurrent <= Math.floor(pcHpMax / 2);
  const enemyBloodied = isEnemy && combatant.public_status === 'BLOODIED';

  const laMax  = combatant.legendary_actions_max   ?? 0;
  const laUsed = combatant.legendary_actions_used   ?? 0;
  const lrMax  = combatant.legendary_resistances_max  ?? 0;
  const lrUsed = combatant.legendary_resistances_used ?? 0;
  const hasLegendary = isEnemy && (laMax > 0 || lrMax > 0);

  const resistances = combatant.resistances || [];
  const immunities  = combatant.immunities  || [];
  const hasAnyMod   = MODS.some(m => (combatant[`mod_${m}`] ?? 0) !== 0);

  const rxUsed = isPC ? reactionUsed : enemyReactionUsed;
  const canToggleReaction = isDM || (!isDM && isPC && myCombatantId && combatant.id === myCombatantId);

  // ---- Handlers ----

  async function saveInitiative() {
    if (savingRef.current) return;
    const total = parseInt(inputValue, 10);
    if (isNaN(total)) return;
    savingRef.current = true;
    await supabase.rpc('set_initiative', { p_combatant_id: combatant.id, p_total: total });
    savingRef.current = false;
    onUpdate();
  }

  async function moveUp() {
    if (idx === 0) return;
    const neighbor = sorted[idx - 1];
    await supabase.rpc('set_initiative', { p_combatant_id: combatant.id, p_total: (neighbor.initiative_total ?? 0) + 1 });
    onUpdate();
  }

  async function moveDown() {
    if (idx === sorted.length - 1) return;
    const neighbor = sorted[idx + 1];
    await supabase.rpc('set_initiative', { p_combatant_id: combatant.id, p_total: Math.max(0, (neighbor.initiative_total ?? 0) - 1) });
    onUpdate();
  }

  async function toggleReaction() {
    if (!canToggleReaction) return;
    if (isPC) {
      if (!playerState) return;
      await supabase.from('player_encounter_state').update({ reaction_used: !reactionUsed }).eq('id', playerState.id);
    } else {
      await supabase.from('combatants').update({ reaction_used: !enemyReactionUsed }).eq('id', combatant.id);
    }
    onUpdate();
  }

  // Toggle concentration on a PC row (DM only)
  async function togglePcConcentration() {
    if (!isDM || !playerState) return;
    const updates = { concentration: !concentration };
    // If removing concentration, also clear any pending check DC
    if (concentration) updates.concentration_check_dc = null;
    await supabase.from('player_encounter_state').update(updates).eq('id', playerState.id);
    onUpdate();
  }

  // Toggle a condition on a PC row (DM only) — writes to player_encounter_state
  async function togglePcCondition(code) {
    if (!isDM || !playerState) return;
    const current = playerState.conditions || [];
    const updated = current.includes(code) ? current.filter(c => c !== code) : [...current, code];
    await supabase.from('player_encounter_state').update({ conditions: updated }).eq('id', playerState.id);
    onUpdate();
  }

  async function applyEnemyDamage(amount) {
    if (!amount || amount <= 0) return;
    const oldHp = combatant.hp_current ?? 0;
    const newHp = Math.max(0, oldHp - amount);
    const isBloodied = newHp > 0 && newHp <= Math.floor((combatant.hp_max ?? 0) / 2);
    await supabase.from('combatants').update({
      hp_current: newHp,
      public_status: isBloodied ? 'BLOODIED' : null,
    }).eq('id', combatant.id);
    logCombat(encounterId, 'DM', 'damage', `${combatant.name}: -${amount} HP (${oldHp} → ${newHp})`);
    onUpdate();
  }

  async function applyEnemyHeal(amount) {
    if (!amount || amount <= 0) return;
    const oldHp = combatant.hp_current ?? 0;
    const newHp = Math.min(combatant.hp_max ?? 999, oldHp + amount);
    const isBloodied = newHp > 0 && newHp <= Math.floor((combatant.hp_max ?? 0) / 2);
    await supabase.from('combatants').update({
      hp_current: newHp,
      public_status: isBloodied ? 'BLOODIED' : null,
    }).eq('id', combatant.id);
    logCombat(encounterId, 'DM', 'heal', `${combatant.name}: +${amount} HP (${oldHp} → ${newHp})`);
    onUpdate();
  }

  async function applyPcDamage(amount) {
    if (!playerState || !amount || amount <= 0) return;
    const curHp   = playerState.current_hp ?? 0;
    const curTemp = playerState.temp_hp ?? 0;
    const pcConds = playerState.conditions || [];
    const isConc  = playerState.concentration ?? false;

    if (isConc) {
      const dc = Math.max(10, Math.floor(amount / 2));
      clearTimeout(conTimer.current);
      setConDc(dc);
      conTimer.current = setTimeout(() => setConDc(null), 7000);
      await supabase.from('player_encounter_state').update({ concentration_check_dc: dc }).eq('id', playerState.id);
      supabase.from('concentration_checks').insert({
        encounter_id: encounterId,
        player_name: combatant.name,
        dc,
      }).then(() => {});
    }

    let remaining = amount;
    const updates = {};
    if (curTemp > 0) {
      const burn = Math.min(curTemp, remaining);
      remaining -= burn;
      updates.temp_hp = curTemp - burn;
    }
    const oldHp = curHp;
    if (remaining > 0) {
      const newHp = Math.max(0, curHp - remaining);
      updates.current_hp = newHp;
      await supabase.from('player_encounter_state').update(updates).eq('id', playerState.id);
      const hasUnc = pcConds.includes('UNC');
      if (newHp === 0 && !hasUnc) {
        await supabase.from('player_encounter_state').update({ conditions: [...pcConds, 'UNC'] }).eq('id', playerState.id);
      } else if (newHp > 0 && hasUnc) {
        await supabase.from('player_encounter_state').update({ conditions: pcConds.filter(c => c !== 'UNC') }).eq('id', playerState.id);
      }
      logCombat(encounterId, 'DM', 'damage', `${combatant.name}: -${amount} HP (${oldHp} → ${newHp})`);
    } else {
      await supabase.from('player_encounter_state').update(updates).eq('id', playerState.id);
      logCombat(encounterId, 'DM', 'damage', `${combatant.name}: -${amount} (temp HP absorbed)`);
    }
    onUpdate();
  }

  async function applyPcHeal(amount) {
    if (!playerState || !amount || amount <= 0) return;
    const curHp = playerState.current_hp ?? 0;
    const effectiveMax = pcMaxOverride ?? pcProfileMax ?? 999;
    const newHp = Math.min(effectiveMax, curHp + amount);
    const pcConds = playerState.conditions || [];
    await supabase.from('player_encounter_state').update({ current_hp: newHp }).eq('id', playerState.id);
    if (newHp > 0 && pcConds.includes('UNC')) {
      await supabase.from('player_encounter_state').update({ conditions: pcConds.filter(c => c !== 'UNC') }).eq('id', playerState.id);
    }
    logCombat(encounterId, 'DM', 'heal', `${combatant.name}: +${amount} HP (${curHp} → ${newHp})`);
    onUpdate();
  }

  async function toggleEnemyCondition(code) {
    const updated = conditions.includes(code) ? conditions.filter(c => c !== code) : [...conditions, code];
    await supabase.from('combatants').update({ conditions: updated }).eq('id', combatant.id);
    onUpdate();
  }

  async function toggleDamageType(field, type) {
    const arr = combatant[field] || [];
    const updated = arr.includes(type) ? arr.filter(t => t !== type) : [...arr, type];
    await supabase.from('combatants').update({ [field]: updated }).eq('id', combatant.id);
    onUpdate();
  }

  async function spendLegendary(field, max) {
    const cur = combatant[field] ?? 0;
    if (cur >= max) return;
    await supabase.from('combatants').update({ [field]: cur + 1 }).eq('id', combatant.id);
    onUpdate();
  }

  async function restoreLegendary(field) {
    const cur = combatant[field] ?? 0;
    if (cur <= 0) return;
    await supabase.from('combatants').update({ [field]: cur - 1 }).eq('id', combatant.id);
    onUpdate();
  }

  async function resetLegendary(field) {
    await supabase.from('combatants').update({ [field]: 0 }).eq('id', combatant.id);
    onUpdate();
  }

  async function removeCombatant() {
    if (!window.confirm(`Remove ${combatant.name}?`)) return;
    logCombat(encounterId, 'DM', 'remove', `${combatant.name} removed from encounter`);
    await supabase.from('combatants').delete().eq('id', combatant.id);
    onUpdate();
  }

  const atTop    = idx === 0;
  const atBottom = idx === sorted.length - 1;

  return (
    <div className={`initiative-row ${isActive ? 'active-turn' : ''}`} style={{ display: 'block', padding: '8px 12px' }}>

      {/* ---- Main header row ---- */}
      <div className="initiative-row-main" onClick={() => isDM && isEnemy && setExpanded(e => !e)}>
        {isDM && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginRight: 2 }}>
            <button style={{ fontSize: 9, lineHeight: 1, padding: '1px 3px', opacity: atTop ? 0.15 : 0.5, cursor: atTop ? 'default' : 'pointer', background: 'none', border: 'none', color: 'var(--text-secondary)' }}
              onClick={e => { e.stopPropagation(); moveUp(); }} disabled={atTop}>▲</button>
            <button style={{ fontSize: 9, lineHeight: 1, padding: '1px 3px', opacity: atBottom ? 0.15 : 0.5, cursor: atBottom ? 'default' : 'pointer', background: 'none', border: 'none', color: 'var(--text-secondary)' }}
              onClick={e => { e.stopPropagation(); moveDown(); }} disabled={atBottom}>▼</button>
          </div>
        )}

        {isDM ? (
          <input
            className="initiative-number-input"
            type="number"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onFocus={() => { isFocused.current = true; }}
            onBlur={() => { isFocused.current = false; saveInitiative(); }}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); e.stopPropagation(); }}
            onClick={e => e.stopPropagation()}
            placeholder="—"
          />
        ) : (
          <span className="initiative-number">{combatant.initiative_total ?? '—'}</span>
        )}

        <div className="initiative-name-block">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span className="initiative-name">{combatant.name}</span>
            <span className={`badge badge-${combatant.side.toLowerCase()}`}>{combatant.side}</span>
            {(enemyBloodied || pcBloodied) && <span className="badge badge-bloodied">BLOODIED</span>}
            {wsActive && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: '#1a3a1a', color: 'var(--accent-green)' }}>🐻 BEAST</span>}
          </div>
        </div>

        {/* Reaction pill — visible to all roles */}
        <button
          className={`reaction-pill ${rxUsed ? 'reaction-pill--used' : 'reaction-pill--ready'} ${canToggleReaction ? 'reaction-pill--clickable' : ''}`}
          onClick={e => { e.stopPropagation(); toggleReaction(); }}
          style={{ cursor: canToggleReaction ? 'pointer' : 'default' }}
          title={canToggleReaction ? (rxUsed ? 'Restore reaction' : 'Mark reaction used') : undefined}
        >
          ⚡ {rxUsed ? 'USED' : 'REACT'}
        </button>

        {isDM && isEnemy && <span className="expand-toggle" style={{ marginLeft: 4 }}>{expanded ? '▲' : '▼'}</span>}
      </div>

      {/* ---- HP bars ---- */}
      {(showPcHp || showEnemyHp) && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {isPC && wsActive && wsHpMax != null && (
            <MiniHpBar current={wsHpCurrent} max={wsHpMax} color="var(--accent-green)" label={wsFormName ? `🐻 ${wsFormName}` : '🐻 Beast Form'} />
          )}
          {showPcHp && <MiniHpBar current={pcHpCurrent} max={pcHpMax} tempHp={tempHp} label={wsActive ? 'Player HP' : null} />}
          {showEnemyHp && <MiniHpBar current={enemyHpCurrent} max={enemyHpMax} />}
        </div>
      )}

      {/* ---- PC row extras — stat chips + DM controls ---- */}
      {isPC && (
        <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Passive perception — DM only */}
          {isDM && passivePerception !== null && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-panel-3)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px' }}>
              PP {passivePerception}
            </span>
          )}

          {/* Concentration — DM can click to toggle; others read-only */}
          {isDM ? (
            <button
              onClick={e => { e.stopPropagation(); togglePcConcentration(); }}
              style={{
                fontSize: 10, padding: '1px 7px', borderRadius: 3, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${concentration ? 'var(--accent-gold)' : 'var(--border)'}`,
                background: concentration ? '#3a2e00' : 'var(--bg-panel-3)',
                color: concentration ? 'var(--accent-gold)' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
              title={concentration ? 'Remove concentration' : 'Set concentrating'}
            >
              🔮 {concentration ? 'Concentrating' : 'Concentration'}
            </button>
          ) : (
            concentration && (
              <span style={{ fontSize: 10, color: 'var(--accent-gold)', background: '#3a2e00', border: '1px solid var(--accent-gold)', borderRadius: 3, padding: '1px 5px' }}>
                🔮 CON
              </span>
            )
          )}
        </div>
      )}

      {/* ---- Condition chips ---- */}
      {displayConditions.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {displayConditions.map(code => (
              <span
                key={code}
                className="condition-chip"
                style={{
                  background: CONDITION_COLOURS[code] || 'var(--cond-default)',
                  cursor: isDM ? 'pointer' : 'default',
                  userSelect: 'none',
                }}
                onClick={e => {
                  if (!isDM) return;
                  e.stopPropagation();
                  isPC ? togglePcCondition(code) : toggleEnemyCondition(code);
                }}
                title={isDM ? `Remove ${code}` : undefined}
              >{code}</span>
            ))}
          </div>
        </div>
      )}

      {/* ---- DM condition picker on PC rows ---- */}
      {isDM && isPC && (
        <div style={{ marginTop: 4 }}>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }}
            onClick={e => { e.stopPropagation(); setCondPickerOpen(p => !p); }}>
            {condPickerOpen ? 'Close Conditions' : '+ Conditions'}
          </button>
          {condPickerOpen && (
            <div className="condition-picker" style={{ marginTop: 6 }}>
              {CONDITIONS.map(({ code }) => (
                <button
                  key={code}
                  className={`condition-picker-btn ${pcConditions.includes(code) ? 'active' : ''}`}
                  style={{ background: pcConditions.includes(code) ? CONDITION_COLOURS[code] : undefined }}
                  onClick={e => { e.stopPropagation(); togglePcCondition(code); }}
                >{code}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- Legendary pips — visible to all roles ---- */}
      {hasLegendary && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 2 }}>
          {laMax > 0 && (
            <LegendaryPips
              label="LA" max={laMax} used={laUsed} isDM={isDM}
              onSpend={() => spendLegendary('legendary_actions_used', laMax)}
              onRestore={() => restoreLegendary('legendary_actions_used')}
              onReset={() => resetLegendary('legendary_actions_used')}
              isActive={isActive}
            />
          )}
          {lrMax > 0 && (
            <LegendaryPips
              label="LR" max={lrMax} used={lrUsed} isDM={isDM}
              onSpend={() => spendLegendary('legendary_resistances_used', lrMax)}
              onRestore={() => restoreLegendary('legendary_resistances_used')}
              onReset={() => resetLegendary('legendary_resistances_used')}
              isActive={false}
            />
          )}
        </div>
      )}

      {/* ---- CON check banner — DM-side 7s flash ---- */}
      {conDc !== null && (
        <div className="con-check-banner con-check-banner--dm" style={{ marginTop: 6 }}>
          <span className="con-check-label">🔮 CON SAVE</span>
          <span className="con-check-dc">DC {conDc}</span>
        </div>
      )}

      {/* ---- PC DMG/HEAL widget (DM only) ---- */}
      {isPC && isDM && showPcHp && (
        <div style={{ marginTop: 6 }}>
          <InlineDmgHeal onDamage={applyPcDamage} onHeal={applyPcHeal} />
        </div>
      )}

      {/* ---- Enemy expanded panel (DM only) ---- */}
      {isDM && isEnemy && expanded && (
        <div className="monster-dm-controls">

          <div style={{ marginBottom: 10 }}>
            <InlineDmgHeal onDamage={applyEnemyDamage} onHeal={applyEnemyHeal} />
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              {combatant.hp_current} / {combatant.hp_max} HP
            </div>
          </div>

          <EnemySlotGrid combatant={combatant} onUpdate={onUpdate} />

          {hasAnyMod && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {MODS.map(m => {
                const val = combatant[`mod_${m}`] ?? 0;
                return (
                  <div key={m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--bg-panel-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 5px', minWidth: 30 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{m}</span>
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{val >= 0 ? '+' : ''}{val}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginBottom: 8 }}>
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px', marginBottom: 4 }}
              onClick={() => setResPicker(p => !p)}>
              {resPicker ? 'Close' : `Resist/Immune ${resistances.length + immunities.length > 0 ? `(${resistances.length + immunities.length})` : ''}`}
            </button>
            {resPicker && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Resistances</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
                  {DAMAGE_TYPES.map(t => (
                    <button key={t} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${resistances.includes(t) ? 'var(--accent-blue)' : 'var(--border)'}`, background: resistances.includes(t) ? 'rgba(74,158,255,0.2)' : 'var(--bg-panel-3)', color: resistances.includes(t) ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
                      onClick={() => toggleDamageType('resistances', t)}
                    >{t}</button>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Immunities</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {DAMAGE_TYPES.map(t => (
                    <button key={t} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${immunities.includes(t) ? 'var(--accent-gold)' : 'var(--border)'}`, background: immunities.includes(t) ? 'rgba(240,180,41,0.15)' : 'var(--bg-panel-3)', color: immunities.includes(t) ? 'var(--accent-gold)' : 'var(--text-secondary)' }}
                      onClick={() => toggleDamageType('immunities', t)}
                    >{t}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 8 }}>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '2px 8px' }}
              onClick={() => setCondPickerOpen(p => !p)}>
              {condPickerOpen ? 'Close Conditions' : '+ Conditions'}
            </button>
            {condPickerOpen && (
              <div className="condition-picker" style={{ marginTop: 6 }}>
                {CONDITIONS.map(({ code }) => (
                  <button key={code} className={`condition-picker-btn ${conditions.includes(code) ? 'active' : ''}`}
                    style={{ background: conditions.includes(code) ? CONDITION_COLOURS[code] : undefined }}
                    onClick={() => toggleEnemyCondition(code)}
                  >{code}</button>
                ))}
              </div>
            )}
          </div>

          {combatant.notes && <div className="monster-notes" style={{ marginBottom: 8 }}>{combatant.notes}</div>}
          <button className="btn btn-danger" onClick={removeCombatant}>Remove</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ADD COMBATANT INLINE
// ============================================================
function AddCombatantInline({ encounterId, onUpdate }) {
  const [open, setOpen]             = useState(false);
  const [mode, setMode]             = useState('template');
  const [templates, setTemplates]   = useState([]);
  const [templateFilter, setTemplateFilter] = useState('ALL');
  const [adding, setAdding]         = useState(false);

  const [name, setName] = useState('');
  const [ac, setAc]     = useState(10);
  const [hp, setHp]     = useState(10);
  const [mod, setMod]   = useState(0);
  const [side, setSide] = useState('ENEMY');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && mode === 'template') {
      supabase.from('profiles_monsters').select('*').order('name').then(({ data }) => setTemplates(data || []));
    }
  }, [open, mode]);

  async function addFromTemplate(template) {
    setAdding(true);
    await supabase.from('combatants').insert({
      encounter_id:               encounterId,
      name:                       template.name,
      side:                       template.side || 'ENEMY',
      ac:                         template.ac,
      hp_max:                     template.hp_max,
      hp_current:                 template.hp_max,
      initiative_mod:             template.initiative_mod || 0,
      notes:                      template.notes || null,
      mod_str:                    template.mod_str || 0,
      mod_dex:                    template.mod_dex || 0,
      mod_con:                    template.mod_con || 0,
      mod_int:                    template.mod_int || 0,
      mod_wis:                    template.mod_wis || 0,
      mod_cha:                    template.mod_cha || 0,
      resistances:                template.resistances || [],
      immunities:                 template.immunities  || [],
      legendary_actions_max:      template.legendary_actions_max  || 0,
      legendary_resistances_max:  template.legendary_resistances_max || 0,
      slots_max_1: template.slots_max_1 || 0,
      slots_max_2: template.slots_max_2 || 0,
      slots_max_3: template.slots_max_3 || 0,
      slots_max_4: template.slots_max_4 || 0,
      slots_max_5: template.slots_max_5 || 0,
      slots_max_6: template.slots_max_6 || 0,
      slots_max_7: template.slots_max_7 || 0,
      slots_max_8: template.slots_max_8 || 0,
      slots_max_9: template.slots_max_9 || 0,
    });
    setAdding(false);
    onUpdate();
  }

  async function addManual() {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from('combatants').insert({
      encounter_id: encounterId,
      name: name.trim(), side,
      ac: parseInt(ac), hp_max: parseInt(hp), hp_current: parseInt(hp),
      initiative_mod: parseInt(mod),
    });
    setName(''); setAc(10); setHp(10); setMod(0);
    setSaving(false);
    onUpdate();
  }

  if (!open) return <button className="btn btn-ghost" onClick={() => setOpen(true)}>+ Add Combatant</button>;

  const filteredTemplates = templateFilter === 'ALL' ? templates : templates.filter(t => t.side === templateFilter);

  return (
    <div className="add-combatant-form">
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1, borderColor: mode === 'template' ? 'var(--accent-blue)' : 'var(--border)', color: mode === 'template' ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
          onClick={() => setMode('template')}>From Template</button>
        <button className="btn btn-ghost" style={{ flex: 1, borderColor: mode === 'manual' ? 'var(--accent-blue)' : 'var(--border)', color: mode === 'manual' ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
          onClick={() => setMode('manual')}>Manual</button>
        <button className="btn btn-ghost btn-icon" onClick={() => setOpen(false)}>✕</button>
      </div>

      {mode === 'template' && (
        <>
          <div style={{ display: 'flex', gap: 6 }}>
            {['ALL','ENEMY','NPC'].map(f => (
              <button key={f} className="btn btn-ghost"
                style={{ fontSize: 11, padding: '2px 8px', borderColor: templateFilter === f ? 'var(--accent-blue)' : 'var(--border)', color: templateFilter === f ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
                onClick={() => setTemplateFilter(f)}>{f}</button>
            ))}
          </div>
          {templates.length === 0 && <div className="empty-state">No templates yet. Add them in Manage.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
            {filteredTemplates.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}>
                <div>
                  <span className={`badge badge-${(t.side || 'enemy').toLowerCase()}`} style={{ marginRight: 6 }}>{t.side || 'ENEMY'}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>AC {t.ac} HP {t.hp_max}</span>
                  {(t.legendary_actions_max > 0 || t.legendary_resistances_max > 0) && (
                    <span style={{ fontSize: 10, color: 'var(--accent-gold)', marginLeft: 6 }}>★ Legendary</span>
                  )}
                </div>
                <button className="btn btn-primary btn-icon" onClick={() => addFromTemplate(t)} disabled={adding} style={{ fontSize: 16, minWidth: 32, minHeight: 32 }}>+</button>
              </div>
            ))}
          </div>
        </>
      )}

      {mode === 'manual' && (
        <>
          <input className="form-input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Side</label>
              <select className="form-input" value={side} onChange={e => setSide(e.target.value)}>
                <option value="ENEMY">Enemy</option>
                <option value="NPC">NPC</option>
                <option value="PC">PC</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">AC</label>
              <input className="form-input" type="number" value={ac} onChange={e => setAc(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">HP</label>
              <input className="form-input" type="number" value={hp} onChange={e => setHp(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Init Mod</label>
              <input className="form-input" type="number" value={mod} onChange={e => setMod(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <button className="btn btn-primary" onClick={addManual} disabled={saving || !name.trim()}>
              {saving ? 'Adding…' : 'Add'}
            </button>
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}