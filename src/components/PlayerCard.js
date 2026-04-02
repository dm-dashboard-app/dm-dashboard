import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import './PlayerCardRewrite.css';
import SpellSlotGrid from './SpellSlotGrid';
import WildShapeBlock from './WildShapeBlock';
import SkillsModal from './SkillsModal';
import {
  readNumberField,
  ABILITY_KEYS,
  getAbilityScores,
  getAbilityModifiers,
  getSavingThrowTotals,
  getFinalSpellSaveDC,
  getFinalSpellAttackBonus,
  formatModifier,
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

const ABILITY_LABELS = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };

export default function PlayerCard({ combatant, state, role, isEditMode, encounterId, onUpdate }) {
  const profile = state?.profiles_players;
  const canEdit = role === 'dm' || role === 'player';
  const readOnly = role === 'display';
  const canRestore = role === 'dm';
  const isPlayer = role === 'player';
  const actionActor = isPlayer ? (profile?.name || 'Player') : 'DM';
  const [localHp, setLocalHp] = useState(null);
  const [showSkills, setShowSkills] = useState(false);

  const dbHp = state?.current_hp ?? combatant?.hp_current ?? 0;
  const hp = localHp !== null ? localHp : dbHp;
  const profileMax = profile?.max_hp ?? combatant?.hp_max ?? 1;
  const maxHpOverride = state?.max_hp_override ?? null;
  const maxHp = maxHpOverride !== null ? maxHpOverride : profileMax;
  const tempHp = state?.temp_hp ?? 0;
  const hpPercent = Math.max(0, Math.min(100, (hp / Math.max(1, maxHp)) * 100));
  const concentration = state?.concentration ?? false;
  const reactionUsed = state?.reaction_used ?? false;
  const pendingConDc = concentration ? (state?.concentration_check_dc ?? null) : null;
  const resourceConfigs = getSurfaceResourceConfig(profile || {}, state || {}, RESOURCE_SURFACES.PLAYER_CARD).filter(resource => resource.id !== 'warlock-slots');
  const hitDiceResource = resourceConfigs.find(resource => resource.id === 'hit-dice' || resource.label === 'Hit Dice');
  const otherResources = resourceConfigs.filter(resource => resource !== hitDiceResource);
  const abilityScores = getAbilityScores(profile || {});
  const abilityModifiers = getAbilityModifiers(profile || {});
  const saveTotals = getSavingThrowTotals(profile || {});
  const spellSaveDc = profile?.spell_save_dc || getFinalSpellSaveDC(profile || {});
  const spellAttackBonus = profile?.spell_attack_bonus || getFinalSpellAttackBonus(profile || {});
  const armorClass = profile?.ac ?? combatant?.ac ?? '—';
  const passivePerception = profile ? 10 + (profile.skill_perception ?? 0) : null;

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

  async function promptTempHp() {
    if (!state || !canRestore) return;
    const value = window.prompt('Set temporary HP to:', String(tempHp || 0));
    if (value === null) return;
    const newTemp = Math.max(0, parseInt(value, 10) || 0);
    await supabase.from('player_encounter_state').update({ temp_hp: newTemp }).eq('id', state.id);
    onUpdate();
  }

  async function promptBonusHp() {
    if (!state || !canRestore) return;
    const value = window.prompt('Grant bonus max HP by how much?', '0');
    if (value === null) return;
    const delta = Math.max(0, parseInt(value, 10) || 0);
    if (delta <= 0) return;
    const newMax = maxHp + delta;
    const overrideVal = newMax === profileMax ? null : newMax;
    const newHp = Math.min(hp + delta, newMax);
    setLocalHp(newHp);
    await supabase.from('player_encounter_state').update({ max_hp_override: overrideVal, current_hp: newHp }).eq('id', state.id);
    onUpdate();
  }

  async function resetMaxHp() {
    if (!state || !canRestore) return;
    const newHp = Math.min(hp, profileMax);
    setLocalHp(newHp);
    await supabase.from('player_encounter_state').update({ max_hp_override: null, current_hp: newHp }).eq('id', state.id);
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
    <>
      <div className="player-card">
        <div className="portrait-strip">
          {profile?.portrait_url ? <img src={profile.portrait_url} alt={combatant.name} className="portrait-img" /> : <div className="portrait-placeholder"><span className="portrait-initials">{initials}</span></div>}
        </div>

        <div className="card-body player-card-body-reflow">
          <div className="player-card-line player-card-line--header">
            <span className="card-name">{combatant?.name}</span>
            <button className={`reaction-pill ${canEdit ? 'reaction-pill--clickable' : ''} ${reactionUsed ? 'reaction-pill--used' : 'reaction-pill--ready'}`} onClick={handleToggleReaction} disabled={!canEdit} title={reactionUsed ? 'Restore reaction' : 'Mark reaction used'}>⚡ {reactionUsed ? 'USED' : 'REACT'}</button>
          </div>

          {pendingConDc !== null && (
            <div className="con-check-banner">
              <div className="con-check-banner-header"><span className="con-check-label">Concentration Check</span><span className="con-check-dc">DC {pendingConDc}</span></div>
              <div className="con-check-actions"><button className="con-check-pass" onClick={handleConPass}>Passed</button><button className="con-check-fail" onClick={handleConFail}>Failed</button></div>
            </div>
          )}

          <button className={`player-concentration-bar ${concentration ? 'player-concentration-bar--active' : ''}`} onClick={handleToggleConcentration} disabled={!canEdit}>
            <span className="player-concentration-label">Concentration</span>
            <span className="player-concentration-value">{concentration ? 'Active' : 'Off'}</span>
          </button>

          <div className="player-card-four-up">
            <InfoStatBox label="AC" value={armorClass} highlight="ac" />
            <InfoStatBox label="PP" value={passivePerception ?? '—'} />
            <InfoStatBox label="Spell DC" value={spellSaveDc > 0 ? spellSaveDc : '—'} />
            <InfoStatBox label="Spell ATK" value={spellAttackBonus ? formatModifier(spellAttackBonus) : '—'} />
          </div>

          <div className="player-hp-hero-wrap">
            <div className="player-hp-hero-track">
              <div className="player-hp-hero-fill" style={{ width: `${hpPercent}%`, background: hpColor(hpPercent) }} />
              {tempHp > 0 && <div className="player-hp-hero-temp" style={{ left: `${hpPercent}%`, width: `${Math.min(100 - hpPercent, (tempHp / Math.max(1, maxHp)) * 100)}%` }} />}
              <div className="player-hp-hero-text">{hp} / {maxHp}{tempHp > 0 ? ` +${tempHp} temp` : ''}</div>
            </div>
          </div>

          {canEdit && <DmgHealRow onDamage={handleApplyDamage} onHeal={handleApplyHeal} />}

          {hitDiceResource ? <HitDiceRow resource={hitDiceResource} state={state} readOnly={!canRestore} onUpdateFields={updateResourceFields} /> : null}

          {canRestore && (
            <div className="player-bonus-temp-row">
              <button className="btn btn-ghost dm-card-adjustment-btn dm-card-adjustment-btn--gold" onClick={promptBonusHp}>Bonus HP</button>
              <button className="btn btn-ghost dm-card-adjustment-btn dm-card-adjustment-btn--blue" onClick={promptTempHp}>Temp HP</button>
              {maxHpOverride !== null ? <button className="btn btn-ghost dm-card-adjustment-btn" onClick={resetMaxHp}>Reset HP</button> : null}
            </div>
          )}

          <SectionGrid title="Ability Scores" className="player-ability-grid">
            {ABILITY_KEYS.map(key => (
              <div key={key} className="player-ability-cell">
                <span className="player-ability-label">{ABILITY_LABELS[key]}</span>
                <span className="player-ability-score">{abilityScores[key]}</span>
                <span className="player-ability-mod">{formatModifier(abilityModifiers[key])}</span>
              </div>
            ))}
          </SectionGrid>

          <SectionGrid title="Saving Throws" className="player-save-grid">
            {ABILITY_KEYS.map(key => (
              <div key={key} className="player-save-cell">
                <span className="player-save-label">{ABILITY_LABELS[key]}</span>
                <span className="player-save-value">{formatModifier(saveTotals[key])}</span>
              </div>
            ))}
          </SectionGrid>

          {!readOnly && (
            <button className="btn btn-ghost player-card-skills-btn" onClick={() => setShowSkills(true)}>Skills</button>
          )}

          {otherResources.length > 0 && <ResourceSection resources={otherResources} state={state} readOnly={readOnly} onUpdateFields={updateResourceFields} />}

          {profile && <SpellSlotGrid profile={profile} state={state} readOnly={readOnly} canRestore={canRestore} onUpdate={onUpdate} />}

          {profile?.wildshape_enabled && state && <WildShapeBlock state={state} readOnly={readOnly} canRestore={canRestore} onUpdate={onUpdate} encounterId={encounterId} combatant={combatant} actor={actionActor} />}
        </div>
      </div>

      {!readOnly && profile && <SkillsModal open={showSkills} onClose={() => setShowSkills(false)} profile={profile} title={`${combatant?.name || 'Character'} Skills`} />}
    </>
  );
}

function SectionGrid({ title, className, children }) {
  return (
    <div className="player-card-section-group">
      <div className="player-card-section-title">{title}</div>
      <div className={className}>{children}</div>
    </div>
  );
}

function InfoStatBox({ label, value, highlight = '' }) {
  return (
    <div className={`player-info-stat-box ${highlight ? `player-info-stat-box--${highlight}` : ''}`}>
      <span className="player-info-stat-label">{label}</span>
      <span className="player-info-stat-value">{value}</span>
    </div>
  );
}

function HitDiceRow({ resource, state, readOnly, onUpdateFields }) {
  const { current, max } = resolveDisplayedValues(resource, state);
  async function adjust(delta) {
    if (readOnly) return;
    const upperBound = max ?? Math.max(current, 0);
    const next = Math.max(0, Math.min(upperBound, current + delta));
    if (next === current) return;
    await onUpdateFields({ [resource.currentKey]: next, ...(resource.maxKey && max !== null ? { [resource.maxKey]: max } : {}) });
  }
  return (
    <div className="player-hit-dice-row">
      <div className="player-hit-dice-copy">
        <span className="player-hit-dice-label">Hit Dice</span>
        {resource.meta ? <span className="player-hit-dice-meta">{resource.meta}</span> : null}
      </div>
      <div className="player-hit-dice-controls">
        {!readOnly ? <button className="btn btn-icon btn-ghost" style={{ minWidth: 28, minHeight: 28, fontSize: 13 }} onClick={() => adjust(-1)}>−</button> : null}
        <span className="player-hit-dice-value">{current}{max !== null ? ` / ${max}` : ''}</span>
        {!readOnly ? <button className="btn btn-icon btn-ghost" style={{ minWidth: 28, minHeight: 28, fontSize: 13 }} onClick={() => adjust(1)}>+</button> : null}
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
  return (
    <div className="player-resource-section">
      <div className="player-card-section-title">Resources</div>
      {resources.map(resource => <ResourceRow key={resource.id} resource={resource} state={state} readOnly={readOnly} onUpdateFields={onUpdateFields} />)}
    </div>
  );
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
    return (
      <div className="player-resource-row">
        <div className="player-resource-copy">
          <span className="player-resource-label">{resource.label}</span>
          {resource.meta ? <span className="player-resource-meta">{resource.meta}</span> : null}
        </div>
        <div className="player-resource-controls">
          {!readOnly ? <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px', borderColor: toggleState.ready ? 'var(--accent-green)' : 'var(--accent-red)', color: toggleState.ready ? 'var(--accent-green)' : 'var(--accent-red)' }} onClick={handleToggle}>{toggleState.label}</button> : <span className="player-resource-value" style={{ color: toggleState.ready ? 'var(--accent-green)' : 'var(--accent-red)' }}>{toggleState.label}</span>}
        </div>
      </div>
    );
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
    return (
      <div className="player-resource-row">
        <div className="player-resource-copy">
          <span className="player-resource-label">{resource.label}</span>
          {(resource.meta || resource.displaySuffix) ? <span className="player-resource-meta">{[resource.meta, resource.displaySuffix].filter(Boolean).join(' • ')}</span> : null}
        </div>
        <div className="player-resource-controls">
          {!readOnly && <button className="btn btn-icon btn-ghost" style={{ minWidth: 28, minHeight: 28, fontSize: 13 }} onClick={() => adjust(-1)}>−</button>}
          <span className="player-resource-value" style={{ color: isWarlockSlots ? accentColor : undefined }}>{current}{max !== null ? ` / ${max}` : ''}</span>
          {!readOnly && <button className="btn btn-icon btn-ghost" style={{ minWidth: 28, minHeight: 28, fontSize: 13 }} onClick={() => adjust(1)}>+</button>}
        </div>
      </div>
    );
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
  return (
    <div className="player-resource-row">
      <div className="player-resource-copy">
        <span className="player-resource-label">{resource.label}</span>
        {[resource.meta, `${safeCurrent}/${safeMax}`].filter(Boolean).length > 0 ? <span className="player-resource-meta">{[resource.meta, `${safeCurrent}/${safeMax}`].filter(Boolean).join(' • ')}</span> : null}
      </div>
      <div className="player-resource-controls">
        <div className="player-resource-pips">
          {Array.from({ length: safeMax }).map((_, i) => {
            const active = i < safeCurrent;
            return <button key={i} type="button" onClick={() => setPips(active ? i : i + 1)} disabled={readOnly} title={readOnly ? undefined : active ? 'Spend / reduce' : 'Restore / add'} style={{ width: 16, height: 16, borderRadius: '50%', padding: 0, border: `2px solid ${active ? accentColor : 'var(--border-strong)'}`, background: active ? accentFill : 'transparent', cursor: readOnly ? 'default' : 'pointer', opacity: readOnly ? 0.9 : 1 }} />;
          })}
        </div>
      </div>
    </div>
  );
}
