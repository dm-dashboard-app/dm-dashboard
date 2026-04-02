import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import ConditionChipRow from './ConditionChipRow';
import SpellSlotGrid from './SpellSlotGrid';
import WildShapeBlock from './WildShapeBlock';
import {
  readNumberField,
  getClassEntries,
} from '../utils/classResources';
import {
  RESOURCE_SURFACES,
  getSurfaceResourceConfig,
  resolveResourceToggleState,
} from '../utils/resourcePolicy';
import {
  applyPlayerDamage,
  applyPlayerHeal,
  togglePlayerReaction,
  togglePlayerConcentration,
} from '../utils/playerStateMutations';

function nextZeroHpConditions(newHp, conditions = []) {
  const next = [...conditions];
  if (newHp === 0) {
    if (!next.includes('UNC')) next.push('UNC');
    if (!next.includes('PRN')) next.push('PRN');
    return next;
  }
  if (newHp > 0) return next.filter(c => c !== 'UNC');
  return next;
}

function compactObject(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
}

function formatSingleClassEntry(entry) {
  if (!entry) return '';
  const classPart = [entry.displayClass, entry.subclassName].filter(Boolean).join(' • ');
  const levelPart = entry.level ? `Level ${entry.level}` : '';
  return [classPart, levelPart].filter(Boolean).join(' • ');
}

function getPlayerHeaderLines(profile = {}) {
  const classEntries = getClassEntries(profile);
  return {
    classLine: classEntries.map(formatSingleClassEntry).filter(Boolean).join(' / '),
    ancestryLine: profile.ancestry_name || '',
  };
}

function resolveDisplayedValues(resource, state) {
  const rawCurrent = readNumberField(state, [resource.currentKey], null);
  const rawMax = readNumberField(state, [resource.maxKey], null);
  const fallbackCurrent = resource.fallbackCurrent ?? 0;
  const fallbackMax = resource.fallbackMax ?? null;

  if ((rawMax === null || rawMax <= 0) && fallbackMax !== null && fallbackMax > 0) {
    const current = rawCurrent === null || rawCurrent <= 0 ? fallbackCurrent : rawCurrent;
    return { current, max: fallbackMax };
  }

  return {
    current: rawCurrent ?? fallbackCurrent,
    max: rawMax ?? fallbackMax,
  };
}

export default function PlayerCard({ combatant, state, role, isEditMode, encounterId, onUpdate }) {
  const profile = state?.profiles_players;
  const canEdit = role === 'dm' || role === 'player';
  const readOnly = role === 'display';
  const canRestore = role === 'dm';
  const isPlayer = role === 'player';
  const actionActor = isPlayer ? (profile?.name || 'Player') : 'DM';

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
  const pendingConDc = concentration ? (state?.concentration_check_dc ?? null) : null;
  const passivePerception = profile ? 10 + (profile.skill_perception ?? 0) : null;
  const { classLine, ancestryLine } = getPlayerHeaderLines(profile || {});
  const classEntries = getClassEntries(profile || {});
  const resourceConfigs = getSurfaceResourceConfig(profile || {}, state || {}, RESOURCE_SURFACES.PLAYER_CARD)
    .filter(resource => resource.id !== 'warlock-slots');

  useEffect(() => {
    setLocalHp(null);
  }, [dbHp]);

  function hpColor(pct) {
    if (pct > 50) return 'var(--hp-high)';
    if (pct > 25) return 'var(--hp-mid)';
    return 'var(--hp-low)';
  }

  async function handleApplyDamage(amount) {
    if (!state || readOnly || !amount || amount <= 0) return;
    const result = await applyPlayerDamage({ state, combatant, encounterId, amount, actor: actionActor });
    if (result?.updates?.current_hp !== undefined) setLocalHp(result.updates.current_hp);
    onUpdate();
  }

  async function handleApplyHeal(amount) {
    if (!state || readOnly || !amount || amount <= 0) return;
    const result = await applyPlayerHeal({ state, combatant, encounterId, amount, actor: actionActor });
    if (result?.updates?.current_hp !== undefined) setLocalHp(result.updates.current_hp);
    onUpdate();
  }

  async function setHpDirect(val) {
    if (!state || readOnly) return;
    const newHp = Math.max(0, Math.min(maxHp, parseInt(val, 10) || 0));
    const updatedConditions = nextZeroHpConditions(newHp, state.conditions || []);
    setLocalHp(newHp);
    await supabase.from('player_encounter_state').update({ current_hp: newHp, conditions: updatedConditions }).eq('id', state.id);
    onUpdate();
  }

  async function setTempHpDirect(val) {
    if (!state || readOnly) return;
    const newTemp = Math.max(0, parseInt(val, 10) || 0);
    await supabase.from('player_encounter_state').update({ temp_hp: newTemp }).eq('id', state.id);
    onUpdate();
  }

  async function adjustMaxHp(delta) {
    if (!state || !canRestore) return;
    const newMax = Math.max(1, maxHp + delta);
    const overrideVal = newMax === profileMax ? null : newMax;
    const newHp = Math.min(hp, newMax);
    const updates = { max_hp_override: overrideVal };
    if (newHp !== hp) {
      updates.current_hp = newHp;
      setLocalHp(newHp);
    }
    await supabase.from('player_encounter_state').update(updates).eq('id', state.id);
    onUpdate();
  }

  async function resetMaxHp() {
    if (!state || !canRestore) return;
    const newHp = Math.min(hp, profileMax);
    const updates = { max_hp_override: null };
    if (newHp !== hp) {
      updates.current_hp = newHp;
      setLocalHp(newHp);
    }
    await supabase.from('player_encounter_state').update(updates).eq('id', state.id);
    onUpdate();
  }

  async function handleToggleReaction() {
    if (readOnly || !state) return;
    await togglePlayerReaction(state.id, reactionUsed);
    onUpdate();
  }

  async function handleToggleConcentration() {
    if (readOnly || !state) return;
    await togglePlayerConcentration(state.id, concentration);
    onUpdate();
  }

  async function handleConPass() {
    if (!state) return;
    const playerName = profile?.name || combatant?.name;
    if (playerName) {
      const { data: checks } = await supabase.from('concentration_checks').select('id').eq('encounter_id', encounterId).eq('player_name', playerName).eq('result', 'pending').order('created_at', { ascending: false }).limit(1);
      if (checks && checks.length > 0) await supabase.from('concentration_checks').update({ result: 'passed' }).eq('id', checks[0].id);
    }
    await supabase.from('player_encounter_state').update({ concentration_check_dc: null }).eq('id', state.id);
    onUpdate();
  }

  async function handleConFail() {
    if (!state) return;
    const playerName = profile?.name || combatant?.name;
    if (playerName) {
      const { data: checks } = await supabase.from('concentration_checks').select('id').eq('encounter_id', encounterId).eq('player_name', playerName).eq('result', 'pending').order('created_at', { ascending: false }).limit(1);
      if (checks && checks.length > 0) await supabase.from('concentration_checks').update({ result: 'failed' }).eq('id', checks[0].id);
    }
    await supabase.from('player_encounter_state').update({ concentration_check_dc: null, concentration: false }).eq('id', state.id);
    onUpdate();
  }

  async function updateResourceFields(updates) {
    if (!state || readOnly) return;
    const payload = compactObject(updates);
    if (Object.keys(payload).length === 0) return;
    await supabase.from('player_encounter_state').update(payload).eq('id', state.id);
    onUpdate();
  }

  const initials = (combatant?.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="player-card">
      <div className="portrait-strip">
        {profile?.portrait_url ? <img src={profile.portrait_url} alt={combatant.name} className="portrait-img" /> : <div className="portrait-placeholder"><span className="portrait-initials">{initials}</span></div>}
      </div>
      <div className="card-body">
        <div className="card-header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
            <span className="card-name">{combatant?.name}</span>
            {isBloodied && <span className="badge badge-bloodied">BLOODIED</span>}
          </div>
          <div className="card-header-badges">
            {canEdit ? <button className={`reaction-pill reaction-pill--clickable ${reactionUsed ? 'reaction-pill--used' : 'reaction-pill--ready'}`} onClick={handleToggleReaction} title={reactionUsed ? 'Restore reaction' : 'Mark reaction used'}>⚡ {reactionUsed ? 'USED' : 'REACT'}</button> : <span className={`reaction-pill ${reactionUsed ? 'reaction-pill--used' : 'reaction-pill--ready'}`} style={{ cursor: 'default' }}>⚡ {reactionUsed ? 'USED' : 'REACT'}</span>}
          </div>
        </div>

        {(classLine || ancestryLine) && (
          <div className="player-class-line" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {classEntries.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{classEntries.map((entry, index) => <span key={`${entry.displayClass}-${index}`} style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{formatSingleClassEntry(entry)}</span>)}</div>}
            {!classEntries.length && classLine && <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{classLine}</span>}
            {ancestryLine && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ancestryLine}</span>}
          </div>
        )}

        {pendingConDc !== null && (
          <div className="con-check-banner">
            <div className="con-check-banner-header"><span className="con-check-label">🔮 CONCENTRATION CHECK</span><span className="con-check-dc">DC {pendingConDc}</span></div>
            <div className="con-check-actions"><button className="con-check-pass" onClick={handleConPass}>✅ Passed</button><button className="con-check-fail" onClick={handleConFail}>❌ Failed — lose concentration</button></div>
          </div>
        )}

        <div style={{ position: 'relative' }}>
          <div className="hp-bar-track" style={{ height: 10 }}>
            <div className="hp-bar-fill" style={{ width: `${hpPercent}%`, background: hpColor(hpPercent) }} />
            {tempHp > 0 && <div className="hp-bar-temp" style={{ left: `${hpPercent}%`, width: `${Math.min(100 - hpPercent, (tempHp / maxHp) * 100)}%` }} />}
          </div>
        </div>

        <div className="hp-numbers-row">
          {!readOnly ? <HpEditableNumber value={hp} onSet={setHpDirect} /> : <span className="hp-value">{hp}</span>}
          <span className="hp-slash">/</span>
          <span className="hp-value" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{maxHp}</span>
          {tempHp > 0 ? (!readOnly ? <TempHpControl tempHp={tempHp} onSet={setTempHpDirect} /> : <span className="temp-hp-label">+{tempHp} temp</span>) : (!readOnly && <TempHpControl tempHp={tempHp} onSet={setTempHpDirect} />)}
          {maxHpOverride !== null && <span style={{ fontSize: 10, color: 'var(--accent-gold)', marginLeft: 2 }}>✦</span>}
        </div>

        {canEdit && <DmgHealRow onDamage={handleApplyDamage} onHeal={handleApplyHeal} />}

        {canRestore && (
          <div className="max-hp-override-row">
            <span className="max-hp-override-label">Max HP {maxHpOverride !== null ? '✦' : ''}</span>
            <button className="btn btn-icon btn-ghost" style={{ minWidth: 28, minHeight: 28, fontSize: 13 }} onClick={() => adjustMaxHp(-1)}>−</button>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, minWidth: 28, textAlign: 'center' }}>{maxHp}</span>
            <button className="btn btn-icon btn-ghost" style={{ minWidth: 28, minHeight: 28, fontSize: 13 }} onClick={() => adjustMaxHp(1)}>+</button>
            {maxHpOverride !== null && <button className="btn btn-ghost" style={{ fontSize: 11, padding: '1px 6px' }} onClick={resetMaxHp}>↺ reset</button>}
          </div>
        )}

        <div className="stats-row">
          <StatPill label="AC" value={profile?.ac ?? combatant?.ac ?? '—'} />
          {passivePerception !== null && <StatPill label="PP" value={passivePerception} />}
          {profile?.spell_save_dc > 0 && <StatPill label="Spell DC" value={profile.spell_save_dc} />}
          {!!profile?.spell_attack_bonus && <StatPill label="Spell ATK" value={`+${profile.spell_attack_bonus}`} />}
        </div>

        {resourceConfigs.length > 0 && <ResourceSection resources={resourceConfigs} state={state} readOnly={readOnly} onUpdateFields={updateResourceFields} />}

        {profile && <div className="saves-grid">{['str', 'dex', 'con', 'int', 'wis', 'cha'].map(s => <div key={s} className="save-cell"><span className="save-label">{s.toUpperCase()}</span><span className="save-value">{formatMod(profile[`save_${s}`])}</span></div>)}</div>}

        {profile && <SpellSlotGrid profile={profile} state={state} readOnly={readOnly} canRestore={canRestore} onUpdate={onUpdate} />}

        <ConditionChipRow conditions={state?.conditions || []} concentration={concentration} stateId={state?.id} readOnly={readOnly} onUpdate={onUpdate} />

        {!readOnly && <button onClick={handleToggleConcentration} style={{ alignSelf: 'flex-start', fontSize: 11, padding: '3px 9px', borderRadius: 'var(--radius-sm)', border: `1px solid ${concentration ? 'var(--accent-gold)' : 'var(--border-strong)'}`, background: concentration ? '#3a2e00' : 'var(--bg-panel-3)', color: concentration ? 'var(--accent-gold)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}>🔮 {concentration ? 'Concentrating' : 'Concentration'}</button>}
        {readOnly && concentration && <span className="condition-chip condition-chip-con">CON</span>}

        {profile?.wildshape_enabled && state && <WildShapeBlock state={state} readOnly={readOnly} canRestore={canRestore} onUpdate={onUpdate} encounterId={encounterId} combatant={combatant} actor={actionActor} />}
      </div>
    </div>
  );
}

export function DmgHealRow({ onDamage, onHeal, compact = false }) {
  const [amount, setAmount] = useState('');
  const inputRef = useRef(null);
  const n = parseInt(amount, 10);
  const valid = !isNaN(n) && n > 0;
  function handleDamage() { if (!valid) return; onDamage(n); setAmount(''); setTimeout(() => inputRef.current?.focus(), 0); }
  function handleHeal() { if (!valid) return; onHeal(n); setAmount(''); setTimeout(() => inputRef.current?.focus(), 0); }
  return <div className={`hp-dmg-row${compact ? ' hp-dmg-row--compact' : ''}`}><button className="hp-action-btn hp-action-dmg" onClick={handleDamage} disabled={!valid}>⚔ DMG</button><input ref={inputRef} className={`hp-amount-input${compact ? ' hp-amount-input--compact' : ''}`} type="number" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleDamage(); if (e.key === 'Escape') setAmount(''); }} placeholder="—" min={1} /><button className="hp-action-btn hp-action-heal" onClick={handleHeal} disabled={!valid}>HEAL ♥</button></div>;
}

function ResourceSection({ resources, state, readOnly, onUpdateFields }) {
  return <div className="player-resource-section" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resources</div><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{resources.map(resource => <ResourceRow key={resource.id} resource={resource} state={state} readOnly={readOnly} onUpdateFields={onUpdateFields} />)}</div></div>;
}

function ResourceRow({ resource, state, readOnly, onUpdateFields }) {
  const isWarlockSlots = resource.id === 'warlock-slots';
  const accentColor = isWarlockSlots ? 'var(--accent-gold)' : 'var(--accent-blue)';
  const accentFill = isWarlockSlots ? 'rgba(240,180,41,0.22)' : 'var(--accent-blue)';

  if (resource.type === 'toggle') {
    const toggleState = resolveResourceToggleState(resource, state);
    async function handleToggle() {
      if (readOnly) return;
      const nextReady = !toggleState.ready;
      const nextRaw = resource.toggleMode === 'available' ? nextReady : !nextReady;
      await onUpdateFields({ [resource.boolKey]: nextRaw });
    }
    return <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}><div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{resource.label}</span>{resource.meta ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{resource.meta}</span> : null}</div>{!readOnly ? <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px', borderColor: toggleState.ready ? 'var(--accent-green)' : 'var(--accent-red)', color: toggleState.ready ? 'var(--accent-green)' : 'var(--accent-red)' }} onClick={handleToggle}>{toggleState.label}</button> : <span style={{ fontSize: 11, fontWeight: 700, color: toggleState.ready ? 'var(--accent-green)' : 'var(--accent-red)' }}>{toggleState.label}</span>}</div>;
  }

  const { current, max } = resolveDisplayedValues(resource, state);

  if (resource.type === 'counter') {
    const upperBound = max ?? Math.max(current, 0);
    async function adjust(delta) {
      if (readOnly) return;
      const next = Math.max(0, Math.min(upperBound, current + delta));
      if (next === current) return;
      await onUpdateFields({ [resource.currentKey]: next, ...(resource.maxKey && max !== null ? { [resource.maxKey]: max } : {}) });
    }
    return <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}><div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{resource.label}</span>{(resource.meta || resource.displaySuffix) ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{[resource.meta, resource.displaySuffix].filter(Boolean).join(' • ')}</span> : null}</div><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{!readOnly && <button className="btn btn-icon btn-ghost" style={{ minWidth: 28, minHeight: 28, fontSize: 13 }} onClick={() => adjust(-1)}>−</button>}<span style={{ minWidth: 54, textAlign: 'center', fontSize: 12, fontWeight: 700, color: isWarlockSlots ? accentColor : 'var(--text-primary)' }}>{current}{max !== null ? ` / ${max}` : ''}</span>{!readOnly && <button className="btn btn-icon btn-ghost" style={{ minWidth: 28, minHeight: 28, fontSize: 13 }} onClick={() => adjust(1)}>+</button>}</div></div>;
  }

  const safeMax = Math.max(0, max ?? current ?? 0);
  const safeCurrent = Math.max(0, Math.min(safeMax, current ?? 0));
  async function setPips(nextCurrent) {
    if (readOnly) return;
    const clamped = Math.max(0, Math.min(safeMax, nextCurrent));
    const updates = { [resource.currentKey]: clamped };
    if (resource.maxKey && max !== null) updates[resource.maxKey] = max;
    await onUpdateFields(updates);
  }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{resource.label}</span><span style={{ fontSize: 11, color: isWarlockSlots ? accentColor : 'var(--text-muted)' }}>{[resource.meta, `${safeCurrent}/${safeMax}`].filter(Boolean).join(' • ')}</span></div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{Array.from({ length: safeMax }).map((_, i) => { const active = i < safeCurrent; return <button key={i} type="button" onClick={() => setPips(active ? i : i + 1)} disabled={readOnly} title={readOnly ? undefined : active ? 'Spend / reduce' : 'Restore / add'} style={{ width: 16, height: 16, borderRadius: '50%', padding: 0, border: `2px solid ${active ? accentColor : 'var(--border-strong)'}`, background: active ? accentFill : 'transparent', cursor: readOnly ? 'default' : 'pointer', opacity: readOnly ? 0.9 : 1 }} />; })}{safeMax === 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No charges</span>}</div></div>;
}

function StatPill({ label, value }) { return <div className="stat-pill"><span className="stat-pill-label">{label}</span><span className="stat-pill-value">{value}</span></div>; }
function formatMod(val) { const n = parseInt(val, 10); if (Number.isNaN(n)) return '—'; return n >= 0 ? `+${n}` : `${n}`; }
function HpEditableNumber({ value, onSet }) { const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(String(value)); const inputRef = useRef(null); useEffect(() => { if (!editing) setDraft(String(value)); }, [value, editing]); function commit() { setEditing(false); const n = parseInt(draft, 10); if (!Number.isNaN(n) && n !== value) onSet(n); } if (!editing) return <span className="hp-value hp-editable" onClick={() => { setDraft(String(value)); setEditing(true); setTimeout(() => inputRef.current?.select(), 0); }}>{value}</span>; return <input ref={inputRef} className="hp-inline-input hp-value" type="number" value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }} autoFocus />; }
function TempHpControl({ tempHp, onSet }) { const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(String(tempHp)); useEffect(() => { if (!editing) setDraft(String(tempHp)); }, [tempHp, editing]); if (!editing) return <span className="temp-hp-label hp-editable" onClick={() => { setDraft(String(tempHp)); setEditing(true); }} title="Set temp HP">{tempHp > 0 ? `+${tempHp} tmp` : '+ tmp'}</span>; return <input className="hp-inline-input" style={{ width: 48, fontSize: 13 }} type="number" value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => { setEditing(false); const n = parseInt(draft, 10); if (!Number.isNaN(n)) onSet(n); }} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(false); }} autoFocus />; }
