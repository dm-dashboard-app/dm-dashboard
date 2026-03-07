import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const CONDITIONS = [
  { code: 'BLD' }, { code: 'CHM' }, { code: 'DEF' },
  { code: 'FRI' }, { code: 'GRP' }, { code: 'INC' },
  { code: 'INV' }, { code: 'PAR' }, { code: 'PET' },
  { code: 'POI' }, { code: 'PRN' }, { code: 'RES' },
  { code: 'STN' }, { code: 'UNC' }, { code: 'HEX' },
];

const CONDITION_COLOURS = {
  BLD: '#6a3a3a', CHM: '#3a3a6a', DEF: '#4a4a4a',
  FRI: '#5a3a5a', GRP: '#5a4a2a', INC: '#6a2a2a',
  INV: '#2a4a4a', PAR: '#6a5a2a', PET: '#4a4a3a',
  POI: '#2a5a2a', PRN: '#5a5a2a', RES: '#3a4a5a',
  STN: '#5a3a2a', UNC: '#2a2a2a', HEX: '#3d1060',
};

const DAMAGE_TYPES = [
  'Acid','Bludgeoning','Cold','Fire','Force',
  'Lightning','Necrotic','Piercing','Poison',
  'Psychic','Radiant','Slashing','Thunder',
];

function sortCombatants(list) {
  return [...list].sort((a, b) => {
    if (a.initiative_total == null && b.initiative_total == null) return a.id < b.id ? -1 : 1;
    if (a.initiative_total == null) return 1;
    if (b.initiative_total == null) return -1;
    if (b.initiative_total !== a.initiative_total) return b.initiative_total - a.initiative_total;
    const aMod = a.initiative_mod ?? 0;
    const bMod = b.initiative_mod ?? 0;
    if (bMod !== aMod) return bMod - aMod;
    return a.id < b.id ? -1 : 1;
  });
}

function hpColor(pct) {
  if (pct > 50) return 'var(--hp-high)';
  if (pct > 25) return 'var(--hp-mid)';
  return 'var(--hp-low)';
}

function MiniHpBar({ current, max, tempHp = 0, color = null, label = null }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const barColor = color || hpColor(pct);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {label && (
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
      )}
      <div style={{ height: 5, background: 'var(--bg-panel-3)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.3s ease' }} />
        {tempHp > 0 && max > 0 && (
          <div style={{ position: 'absolute', top: 0, left: `${pct}%`, width: `${Math.min(100 - pct, (tempHp / max) * 100)}%`, height: '100%', background: 'var(--hp-temp)', opacity: 0.7, borderRadius: 3 }} />
        )}
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
        {current}{tempHp > 0 ? ` (+${tempHp})` : ''} / {max}
      </span>
    </div>
  );
}

// ============================================================
// COMPACT DMG/HEAL WIDGET (used inline in initiative rows)
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
      <button className="hp-action-btn hp-action-dmg" onClick={handleDamage} disabled={!valid}>
        ⚔ DMG
      </button>
      <input
        ref={inputRef}
        className="hp-amount-input hp-amount-input--compact"
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
      <button className="hp-action-btn hp-action-heal" onClick={handleHeal} disabled={!valid}>
        HEAL ♥
      </button>
    </div>
  );
}

// ============================================================
// MAIN PANEL
// ============================================================
export default function InitiativePanel({ encounter, combatants, playerStates = [], role, onUpdate }) {
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
function InitiativeRow({ combatant, playerState, isActive, isDM, onUpdate, sorted, idx }) {
  const [expanded, setExpanded] = useState(false);
  const [condPickerOpen, setCondPickerOpen] = useState(false);
  const [resPicker, setResPicker] = useState(false);
  const [inputValue, setInputValue] = useState(
    combatant.initiative_total != null ? String(combatant.initiative_total) : ''
  );
  const [conDc, setConDc] = useState(null);
  const conTimer = useRef(null);
  const isFocused = useRef(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!isFocused.current) {
      setInputValue(combatant.initiative_total != null ? String(combatant.initiative_total) : '');
    }
  }, [combatant.initiative_total]);

  useEffect(() => () => clearTimeout(conTimer.current), []);

  const isPC = combatant.side === 'PC';
  const isEnemy = combatant.side === 'ENEMY' || combatant.side === 'NPC';
  const conditions = combatant.conditions || [];

  const pcHpCurrent = playerState?.current_hp ?? null;
  const pcProfileMax = playerState?.profiles_players?.max_hp ?? null;
  const pcMaxOverride = playerState?.max_hp_override ?? null;
  const pcHpMax = pcMaxOverride !== null ? pcMaxOverride : pcProfileMax;
  const tempHp = playerState?.temp_hp ?? 0;
  const concentration = playerState?.concentration ?? false;
  const reactionUsed = playerState?.reaction_used ?? false;
  const displayConditions = isPC ? (playerState?.conditions || []) : conditions;

  const wsActive = playerState?.wildshape_active ?? false;
  const wsHpCurrent = playerState?.wildshape_hp_current ?? 0;
  const wsFormName = playerState?.wildshape_form_name ?? null;
  const wsHpMax = playerState?.wildshape_hp_max ?? null;

  const enemyHpCurrent = combatant.hp_current ?? null;
  const enemyHpMax = combatant.hp_max ?? null;

  const showPcHp = isPC && pcHpCurrent !== null && pcHpMax !== null;
  const showEnemyHp = isEnemy && isDM && enemyHpCurrent !== null && enemyHpMax !== null;

  const pcBloodied = isPC && pcHpCurrent !== null && pcHpMax !== null
    && pcHpCurrent > 0 && pcHpCurrent <= Math.floor(pcHpMax / 2);
  const enemyBloodied = isEnemy && combatant.public_status === 'BLOODIED';
  const enemyReactionUsed = combatant.reaction_used ?? false;

  // Resistances / Immunities
  const resistances = combatant.resistances || [];
  const immunities = combatant.immunities || [];

  // Ability mods
  const mods = ['str','dex','con','int','wis','cha'];
  const hasAnyMod = mods.some(m => (combatant[`mod_${m}`] ?? 0) !== 0);

  async function saveInitiative() {
    if (savingRef.current) return;
    const total = parseInt(inputValue, 10);
    if (isNaN(total)) return;
    savingRef.current = true;
    await supabase.rpc('set_initiative', { p_combatant_id: combatant.id, p_total: total });
    savingRef.current = false;
    onUpdate();
  }

  // Initiative reorder
  async function moveUp() {
    if (idx === 0) return;
    const neighbor = sorted[idx - 1];
    const neighborTotal = neighbor.initiative_total ?? 0;
    await supabase.rpc('set_initiative', { p_combatant_id: combatant.id, p_total: neighborTotal + 1 });
    onUpdate();
  }

  async function moveDown() {
    if (idx === sorted.length - 1) return;
    const neighbor = sorted[idx + 1];
    const neighborTotal = neighbor.initiative_total ?? 0;
    await supabase.rpc('set_initiative', { p_combatant_id: combatant.id, p_total: Math.max(0, neighborTotal - 1) });
    onUpdate();
  }

  // Enemy HP
  async function applyEnemyDamage(amount) {
    if (!amount || amount <= 0) return;
    const newHp = Math.max(0, (combatant.hp_current ?? 0) - amount);
    const updates = { hp_current: newHp };
    if (newHp <= Math.floor((combatant.hp_max ?? 0) / 2) && newHp > 0) {
      updates.public_status = 'BLOODIED';
    } else if (newHp === 0) {
      updates.public_status = null;
    } else {
      updates.public_status = null;
    }
    await supabase.from('combatants').update(updates).eq('id', combatant.id);
    onUpdate();
  }

  async function applyEnemyHeal(amount) {
    if (!amount || amount <= 0) return;
    const newHp = Math.min(combatant.hp_max ?? 999, (combatant.hp_current ?? 0) + amount);
    const updates = { hp_current: newHp };
    if (newHp > Math.floor((combatant.hp_max ?? 0) / 2)) {
      updates.public_status = null;
    } else {
      updates.public_status = 'BLOODIED';
    }
    await supabase.from('combatants').update(updates).eq('id', combatant.id);
    onUpdate();
  }

  // PC damage from initiative panel (DM only)
  async function applyPcDamage(amount) {
    if (!playerState || !amount || amount <= 0) return;
    const curHp = playerState.current_hp ?? 0;
    const curTemp = playerState.temp_hp ?? 0;
    const pcConds = playerState.conditions || [];
    const effectiveMax = pcMaxOverride ?? pcProfileMax ?? 999;
    const isConc = playerState.concentration ?? false;

    if (isConc) {
      clearTimeout(conTimer.current);
      setConDc(Math.max(10, Math.floor(amount / 2)));
      conTimer.current = setTimeout(() => setConDc(null), 7000);
    }

    let remaining = amount;
    const updates = {};

    if (curTemp > 0) {
      const burn = Math.min(curTemp, remaining);
      remaining -= burn;
      updates.temp_hp = curTemp - burn;
    }

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
    } else {
      await supabase.from('player_encounter_state').update(updates).eq('id', playerState.id);
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
    const hasUnc = pcConds.includes('UNC');
    if (newHp > 0 && hasUnc) {
      await supabase.from('player_encounter_state').update({ conditions: pcConds.filter(c => c !== 'UNC') }).eq('id', playerState.id);
    }
    onUpdate();
  }

  async function toggleCondition(code) {
    const updated = conditions.includes(code)
      ? conditions.filter(c => c !== code)
      : [...conditions, code];
    await supabase.from('combatants').update({ conditions: updated }).eq('id', combatant.id);
    onUpdate();
  }

  async function toggleEnemyReaction() {
    await supabase.from('combatants').update({ reaction_used: !enemyReactionUsed }).eq('id', combatant.id);
    onUpdate();
  }

  async function toggleDamageType(field, type) {
    const arr = combatant[field] || [];
    const updated = arr.includes(type) ? arr.filter(t => t !== type) : [...arr, type];
    await supabase.from('combatants').update({ [field]: updated }).eq('id', combatant.id);
    onUpdate();
  }

  async function removeCombatant() {
    if (!window.confirm(`Remove ${combatant.name}?`)) return;
    await supabase.from('combatants').delete().eq('id', combatant.id);
    onUpdate();
  }

  const atTop = idx === 0;
  const atBottom = idx === sorted.length - 1;

  return (
    <div className={`initiative-row ${isActive ? 'active-turn' : ''}`} style={{ display: 'block', padding: '8px 12px' }}>
      {/* Main row */}
      <div className="initiative-row-main" onClick={() => isDM && isEnemy && setExpanded(e => !e)}>
        {/* Reorder arrows (DM only) */}
        {isDM && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginRight: 2 }}>
            <button
              style={{ fontSize: 9, lineHeight: 1, padding: '1px 3px', opacity: atTop ? 0.15 : 0.5, cursor: atTop ? 'default' : 'pointer', background: 'none', border: 'none', color: 'var(--text-secondary)' }}
              onClick={e => { e.stopPropagation(); moveUp(); }}
              disabled={atTop}
              title="Move up"
            >▲</button>
            <button
              style={{ fontSize: 9, lineHeight: 1, padding: '1px 3px', opacity: atBottom ? 0.15 : 0.5, cursor: atBottom ? 'default' : 'pointer', background: 'none', border: 'none', color: 'var(--text-secondary)' }}
              onClick={e => { e.stopPropagation(); moveDown(); }}
              disabled={atBottom}
              title="Move down"
            >▼</button>
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

        {isDM && isEnemy && <span className="expand-toggle">{expanded ? '▲' : '▼'}</span>}
      </div>

      {/* HP bars + status chips */}
      {(showPcHp || showEnemyHp) && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {isPC && wsActive && wsHpMax != null && (
            <MiniHpBar current={wsHpCurrent} max={wsHpMax} color="var(--accent-green)" label={wsFormName ? `🐻 ${wsFormName}` : '🐻 Beast Form'} />
          )}
          {showPcHp && <MiniHpBar current={pcHpCurrent} max={pcHpMax} tempHp={tempHp} label={wsActive ? 'Player HP' : null} />}
          {showEnemyHp && <MiniHpBar current={enemyHpCurrent} max={enemyHpMax} />}

          {isPC && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              {concentration && <span style={{ fontSize: 10, color: 'var(--accent-gold)', fontWeight: 700 }}>🔮CON</span>}
              <span style={{ fontSize: 10, color: reactionUsed ? 'var(--text-muted)' : 'var(--accent-gold)', opacity: reactionUsed ? 0.4 : 1 }}>⚡</span>
              {displayConditions.filter(c => !c.startsWith('EXH')).map(code => (
                <span key={code} style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: CONDITION_COLOURS[code] || 'var(--cond-default)', color: 'var(--text-primary)' }}>{code}</span>
              ))}
              {displayConditions.filter(c => c.startsWith('EXH')).map(code => (
                <span key={code} style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: '#2a1a3a', color: 'var(--accent-purple)' }}>{code}</span>
              ))}
            </div>
          )}

          {isEnemy && isDM && conditions.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {conditions.map(code => (
                <span key={code}
                  style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: CONDITION_COLOURS[code] || 'var(--cond-default)', color: 'var(--text-primary)', cursor: 'pointer' }}
                  onClick={e => { e.stopPropagation(); toggleCondition(code); }}
                >{code}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CON check banner — PC rows, DM applying damage */}
      {conDc !== null && (
        <div className="con-check-banner" style={{ marginTop: 6 }}>
          <span className="con-check-label">🔮 CON SAVE</span>
          <span className="con-check-dc">DC {conDc}</span>
        </div>
      )}

      {/* PC damage widget — DM only, inline */}
      {isPC && isDM && showPcHp && (
        <div style={{ marginTop: 6 }}>
          <InlineDmgHeal onDamage={applyPcDamage} onHeal={applyPcHeal} />
        </div>
      )}

      {/* Enemy expanded panel */}
      {isDM && isEnemy && expanded && (
        <div className="monster-dm-controls">
          {/* DMG / HEAL widget */}
          <div style={{ marginBottom: 10 }}>
            <InlineDmgHeal onDamage={applyEnemyDamage} onHeal={applyEnemyHeal} />
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              {combatant.hp_current} / {combatant.hp_max} HP
            </div>
          </div>

          {/* Reaction toggle */}
          <div style={{ marginBottom: 8 }}>
            <button
              className="btn btn-ghost"
              style={{
                fontSize: 12, padding: '3px 10px', width: '100%',
                borderColor: enemyReactionUsed ? 'var(--border)' : 'var(--accent-gold)',
                color: enemyReactionUsed ? 'var(--text-muted)' : 'var(--accent-gold)',
                opacity: enemyReactionUsed ? 0.5 : 1,
              }}
              onClick={toggleEnemyReaction}
            >
              ⚡ {enemyReactionUsed ? 'Reaction Used' : 'Reaction Available'}
            </button>
          </div>

          {/* Ability mods */}
          {hasAnyMod && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {mods.map(m => {
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

          {/* Resistances & Immunities */}
          <div style={{ marginBottom: 8 }}>
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px', marginBottom: 4 }} onClick={() => setResPicker(p => !p)}>
              {resPicker ? 'Close' : '⚡ Resistances & Immunities'}
            </button>
            {(resistances.length > 0 || immunities.length > 0) && !resPicker && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {resistances.map(t => (
                  <span key={t} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(74,158,255,0.15)', border: '1px solid var(--accent-blue)', color: 'var(--accent-blue)', fontWeight: 700 }}>{t}</span>
                ))}
                {immunities.map(t => (
                  <span key={t} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(240,180,41,0.15)', border: '1px solid var(--accent-gold)', color: 'var(--accent-gold)', fontWeight: 700 }}>{t}</span>
                ))}
              </div>
            )}
            {resPicker && (
              <div style={{ background: 'var(--bg-panel-2)', border: '1px solid var(--border)', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--accent-blue)', fontWeight: 700, marginBottom: 4 }}>RESISTANCES</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {DAMAGE_TYPES.map(t => (
                      <button key={t}
                        style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, fontWeight: 600, cursor: 'pointer', border: `1px solid ${resistances.includes(t) ? 'var(--accent-blue)' : 'var(--border)'}`, background: resistances.includes(t) ? 'rgba(74,158,255,0.2)' : 'var(--bg-panel-3)', color: resistances.includes(t) ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
                        onClick={() => toggleDamageType('resistances', t)}
                      >{t}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--accent-gold)', fontWeight: 700, marginBottom: 4 }}>IMMUNITIES</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {DAMAGE_TYPES.map(t => (
                      <button key={t}
                        style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, fontWeight: 600, cursor: 'pointer', border: `1px solid ${immunities.includes(t) ? 'var(--accent-gold)' : 'var(--border)'}`, background: immunities.includes(t) ? 'rgba(240,180,41,0.15)' : 'var(--bg-panel-3)', color: immunities.includes(t) ? 'var(--accent-gold)' : 'var(--text-secondary)' }}
                        onClick={() => toggleDamageType('immunities', t)}
                      >{t}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Conditions */}
          <div style={{ marginBottom: 8 }}>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '2px 8px' }} onClick={() => setCondPickerOpen(p => !p)}>
              {condPickerOpen ? 'Close Conditions' : '+ Conditions'}
            </button>
            {condPickerOpen && (
              <div className="condition-picker" style={{ marginTop: 6 }}>
                {CONDITIONS.map(({ code }) => (
                  <button key={code} className={`condition-picker-btn ${conditions.includes(code) ? 'active' : ''}`}
                    style={{ background: conditions.includes(code) ? CONDITION_COLOURS[code] : undefined }}
                    onClick={() => toggleCondition(code)}
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
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('template');
  const [templates, setTemplates] = useState([]);
  const [templateFilter, setTemplateFilter] = useState('ALL');
  const [adding, setAdding] = useState(false);

  const [name, setName] = useState('');
  const [ac, setAc] = useState(10);
  const [hp, setHp] = useState(10);
  const [mod, setMod] = useState(0);
  const [side, setSide] = useState('ENEMY');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && mode === 'template') {
      supabase.from('profiles_monsters').select('*').order('name').then(({ data }) => {
        setTemplates(data || []);
      });
    }
  }, [open, mode]);

  async function addFromTemplate(template) {
    setAdding(true);
    await supabase.from('combatants').insert({
      encounter_id: encounterId,
      name: template.name,
      side: template.side || 'ENEMY',
      ac: template.ac,
      hp_max: template.hp_max,
      hp_current: template.hp_max,
      initiative_mod: template.initiative_mod || 0,
      notes: template.notes || null,
      mod_str: template.mod_str || 0,
      mod_dex: template.mod_dex || 0,
      mod_con: template.mod_con || 0,
      mod_int: template.mod_int || 0,
      mod_wis: template.mod_wis || 0,
      mod_cha: template.mod_cha || 0,
      resistances: template.resistances || [],
      immunities: template.immunities || [],
    });
    setAdding(false);
    onUpdate();
  }

  async function addManual() {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from('combatants').insert({
      encounter_id: encounterId,
      name: name.trim(),
      side,
      ac: parseInt(ac),
      hp_max: parseInt(hp),
      hp_current: parseInt(hp),
      initiative_mod: parseInt(mod),
    });
    setName(''); setAc(10); setHp(10); setMod(0);
    setSaving(false);
    onUpdate();
  }

  if (!open) return (
    <button className="btn btn-ghost" onClick={() => setOpen(true)}>+ Add Combatant</button>
  );

  const filteredTemplates = templateFilter === 'ALL'
    ? templates
    : templates.filter(t => t.side === templateFilter);

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
            {['ALL', 'ENEMY', 'NPC'].map(f => (
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
          </div>
        </>
      )}
    </div>
  );
}

const mods = ['str','dex','con','int','wis','cha'];