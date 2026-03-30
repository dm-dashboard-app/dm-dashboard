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

function compactObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  );
}

function findExistingKey(source, candidates = []) {
  if (!source) return null;
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(source, key)) return key;
  }
  return null;
}

function readNumberField(source, candidates = [], fallback = null) {
  const key = findExistingKey(source, candidates);
  if (!key) return fallback;
  const raw = source[key];
  if (raw === null || raw === undefined || raw === '') return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function readBooleanField(source, candidates = [], fallback = null) {
  const key = findExistingKey(source, candidates);
  if (!key) return fallback;
  const raw = source[key];
  if (raw === null || raw === undefined) return fallback;
  return !!raw;
}

function readTextField(source, candidates = [], fallback = '') {
  const key = findExistingKey(source, candidates);
  if (!key) return fallback;
  const raw = source[key];
  if (raw === null || raw === undefined || raw === '') return fallback;
  return String(raw);
}

function getClassEntries(profile = {}) {
  const entries = [];

  if (profile.class_name) {
    entries.push({
      className: String(profile.class_name).toLowerCase(),
      displayClass: profile.class_name,
      subclassName: profile.subclass_name || '',
      level: profile.class_level ?? null,
    });
  }

  if (profile.class_name_2) {
    entries.push({
      className: String(profile.class_name_2).toLowerCase(),
      displayClass: profile.class_name_2,
      subclassName: profile.subclass_name_2 || '',
      level: profile.class_level_2 ?? null,
    });
  }

  return entries;
}

function formatSingleClassEntry(entry) {
  if (!entry) return '';
  const classPart = [entry.displayClass, entry.subclassName].filter(Boolean).join(' • ');
  const levelPart = entry.level ? `Level ${entry.level}` : '';
  return [classPart, levelPart].filter(Boolean).join(' • ');
}

function getPlayerHeaderLines(profile = {}) {
  const classEntries = getClassEntries(profile);

  const classLine = classEntries
    .map(formatSingleClassEntry)
    .filter(Boolean)
    .join(' / ');

  return {
    classLine,
    ancestryLine: profile.ancestry_name || '',
  };
}

function hasClass(profile = {}, classNames = []) {
  const allowed = classNames.map(name => String(name).toLowerCase());
  return getClassEntries(profile).some(entry => allowed.includes(entry.className));
}

function getHitDicePoolResources(state = {}, profile = {}) {
  const poolSpecs = [
    { size: 6, currentKey: 'hit_dice_d6_current', maxKey: 'hit_dice_d6_max' },
    { size: 8, currentKey: 'hit_dice_d8_current', maxKey: 'hit_dice_d8_max' },
    { size: 10, currentKey: 'hit_dice_d10_current', maxKey: 'hit_dice_d10_max' },
    { size: 12, currentKey: 'hit_dice_d12_current', maxKey: 'hit_dice_d12_max' },
  ];

  const resources = poolSpecs
    .map(spec => {
      const maxValue = readNumberField(state, [spec.maxKey], 0);
      const currentValue = readNumberField(state, [spec.currentKey], 0);
      if (!maxValue && !currentValue) return null;
      return {
        id: `hit-dice-d${spec.size}`,
        label: 'Hit Dice',
        type: 'counter',
        currentKey: spec.currentKey,
        maxKey: spec.maxKey,
        displaySuffix: `d${spec.size}`,
      };
    })
    .filter(Boolean);

  if (resources.length > 0) return resources;

  const hitDiceCurrentKey = findExistingKey(state, ['hit_dice_current', 'hit_dice_remaining']);
  const hitDiceMaxKey = findExistingKey(state, ['hit_dice_max']);
  const hitDieSize = readNumberField(state, ['hit_die_size'], readNumberField(profile, ['hit_die_size'], null));

  if (hitDiceCurrentKey || hitDiceMaxKey || hitDieSize || profile.hit_dice_max || profile.hit_die_size) {
    return [{
      id: 'hit-dice',
      label: 'Hit Dice',
      type: 'counter',
      currentKey: hitDiceCurrentKey || 'hit_dice_current',
      maxKey: hitDiceMaxKey || 'hit_dice_max',
      displaySuffix: hitDieSize ? `d${hitDieSize}` : '',
    }];
  }

  return [];
}

function getResourceConfig(profile = {}, state = {}) {
  const resources = [...getHitDicePoolResources(state, profile)];

  if (profile.feat_lucky) {
    const luckyCurrentKey = findExistingKey(state, ['lucky_current', 'lucky_uses_current', 'lucky_uses_remaining']);
    const luckyMaxKey = findExistingKey(state, ['lucky_max', 'lucky_uses_max']);
    const luckyUsedKey = findExistingKey(state, ['lucky_used']);

    if (luckyCurrentKey || luckyMaxKey) {
      resources.push({
        id: 'lucky',
        label: 'Lucky',
        type: 'pips',
        currentKey: luckyCurrentKey || 'lucky_current',
        maxKey: luckyMaxKey || 'lucky_max',
      });
    } else if (luckyUsedKey) {
      resources.push({
        id: 'lucky',
        label: 'Lucky',
        type: 'toggle',
        boolKey: luckyUsedKey,
        trueLabel: 'Used',
        falseLabel: 'Ready',
      });
    }
  }

  if (profile.feat_relentless_endurance || String(profile.ancestry_name || '').toLowerCase() === 'half-orc') {
    const relentlessKey = findExistingKey(state, ['relentless_endurance_used']);
    if (relentlessKey) {
      resources.push({
        id: 'relentless-endurance',
        label: 'Relentless Endurance',
        type: 'toggle',
        boolKey: relentlessKey,
        trueLabel: 'Used',
        falseLabel: 'Ready',
      });
    }
  }

  const classResources = [
    {
      id: 'bardic-inspiration',
      classes: ['bard'],
      label: 'Bardic Inspiration',
      type: 'pips',
      currentKeys: ['bardic_inspiration_current', 'bardic_inspiration_uses_current', 'bardic_inspiration_remaining'],
      maxKeys: ['bardic_inspiration_max', 'bardic_inspiration_uses_max'],
      meta: () => readTextField(state, ['bardic_inspiration_die', 'bardic_inspiration_die_size'], ''),
    },
    {
      id: 'ki',
      classes: ['monk'],
      label: 'Ki',
      type: 'counter',
      currentKeys: ['ki_current', 'ki_points_current'],
      maxKeys: ['ki_max', 'ki_points_max'],
    },
    {
      id: 'channel-divinity',
      classes: ['cleric', 'paladin'],
      label: 'Channel Divinity',
      type: 'pips',
      currentKeys: ['channel_divinity_current', 'channel_divinity_uses_current'],
      maxKeys: ['channel_divinity_max', 'channel_divinity_uses_max'],
    },
    {
      id: 'rage',
      classes: ['barbarian'],
      label: 'Rage',
      type: 'pips',
      currentKeys: ['rage_current', 'rage_uses_current', 'rages_current'],
      maxKeys: ['rage_max', 'rage_uses_max', 'rages_max'],
    },
    {
      id: 'sorcery-points',
      classes: ['sorcerer'],
      label: 'Sorcery Points',
      type: 'counter',
      currentKeys: ['sorcery_points_current'],
      maxKeys: ['sorcery_points_max'],
    },
    {
      id: 'second-wind',
      classes: ['fighter'],
      label: 'Second Wind',
      type: 'toggle',
      boolKeys: ['second_wind_available', 'second_wind_used'],
      trueLabel: 'Ready',
      falseLabel: 'Spent',
    },
    {
      id: 'action-surge',
      classes: ['fighter'],
      label: 'Action Surge',
      type: 'pips',
      currentKeys: ['action_surge_current', 'action_surge_uses_current'],
      maxKeys: ['action_surge_max', 'action_surge_uses_max'],
    },
    {
      id: 'superiority-dice',
      classes: ['fighter'],
      label: 'Superiority Dice',
      type: 'pips',
      currentKeys: ['superiority_dice_current'],
      maxKeys: ['superiority_dice_max'],
      meta: () => readTextField(state, ['superiority_die_size'], ''),
    },
    {
      id: 'lay-on-hands',
      classes: ['paladin'],
      label: 'Lay on Hands',
      type: 'counter',
      currentKeys: ['lay_on_hands_current'],
      maxKeys: ['lay_on_hands_max'],
    },
    {
      id: 'arcane-recovery',
      classes: ['wizard'],
      label: 'Arcane Recovery',
      type: 'toggle',
      boolKeys: ['arcane_recovery_used'],
      trueLabel: 'Used',
      falseLabel: 'Ready',
    },
    {
      id: 'natural-recovery',
      classes: ['druid'],
      label: 'Natural Recovery',
      type: 'toggle',
      boolKeys: ['natural_recovery_used'],
      trueLabel: 'Used',
      falseLabel: 'Ready',
    },
    {
      id: 'warlock-slots',
      classes: ['warlock'],
      label: 'Warlock Slots',
      type: 'pips',
      currentKeys: ['warlock_slots_current', 'warlock_spell_slots_current'],
      maxKeys: ['warlock_slots_max', 'warlock_spell_slots_max'],
      meta: () => {
        const lvl = readNumberField(state, ['warlock_slots_level', 'warlock_slot_level'], null);
        return lvl ? `Lv ${lvl}` : '';
      },
    },
  ];

  classResources.forEach(resource => {
    if (!hasClass(profile, resource.classes)) return;

    if (resource.type === 'toggle') {
      const boolKey = findExistingKey(state, resource.boolKeys || []);
      if (!boolKey) return;
      resources.push({
        id: resource.id,
        label: resource.label,
        type: 'toggle',
        boolKey,
        trueLabel: resource.trueLabel || 'Used',
        falseLabel: resource.falseLabel || 'Ready',
        meta: resource.meta ? resource.meta() : '',
      });
      return;
    }

    const currentKey = findExistingKey(state, resource.currentKeys || []);
    const maxKey = findExistingKey(state, resource.maxKeys || []);
    if (!currentKey && !maxKey) return;

    resources.push({
      id: resource.id,
      label: resource.label,
      type: resource.type,
      currentKey: currentKey || (resource.currentKeys || [])[0],
      maxKey: maxKey || (resource.maxKeys || [])[0],
      meta: resource.meta ? resource.meta() : '',
    });
  });

  return resources;
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

  const pendingConDc = concentration ? (state?.concentration_check_dc ?? null) : null;
  const passivePerception = profile ? (10 + (profile.skill_perception ?? 0)) : null;

  const { classLine, ancestryLine } = getPlayerHeaderLines(profile || {});
  const classEntries = getClassEntries(profile || {});
  const resourceConfigs = getResourceConfig(profile || {}, state || {});

  useEffect(() => { setLocalHp(null); }, [dbHp]);

  function hpColor(pct) {
    if (pct > 50) return 'var(--hp-high)';
    if (pct > 25) return 'var(--hp-mid)';
    return 'var(--hp-low)';
  }

  async function applyDamage(amount) {
    if (!state || readOnly || !amount || amount <= 0) return;

    if (concentration) {
      const dc = Math.max(10, Math.floor(amount / 2));
      await supabase.from('player_encounter_state').update({ concentration_check_dc: dc }).eq('id', state.id);
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
    const updates = { concentration: !concentration };
    if (concentration) updates.concentration_check_dc = null;
    await supabase.from('player_encounter_state').update(updates).eq('id', state.id);
    onUpdate();
  }

  async function handleConPass() {
    if (!state) return;
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
    await supabase.from('player_encounter_state').update({
      concentration_check_dc: null,
      concentration: false,
    }).eq('id', state.id);
    onUpdate();
  }

  async function updateResourceFields(updates) {
    if (!state || readOnly) return;
    const payload = compactObject(updates);
    if (Object.keys(payload).length === 0) return;
    await supabase.from('player_encounter_state').update(payload).eq('id', state.id);
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
        <div className="card-header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
            <span className="card-name">{combatant?.name}</span>
            {isBloodied && <span className="badge badge-bloodied">BLOODIED</span>}
          </div>
          <div className="card-header-badges">
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

        {(classLine || ancestryLine) && (
          <div className="player-class-line" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {classEntries.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {classEntries.map((entry, index) => (
                  <span
                    key={`${entry.displayClass}-${index}`}
                    style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}
                  >
                    {formatSingleClassEntry(entry)}
                  </span>
                ))}
              </div>
            )}
            {!classEntries.length && classLine && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                {classLine}
              </span>
            )}
            {ancestryLine && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ancestryLine}</span>
            )}
          </div>
        )}

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

        {canEdit && (
          <DmgHealRow onDamage={applyDamage} onHeal={applyHeal} />
        )}

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

        <div className="stats-row">
          <StatPill label="AC" value={profile?.ac ?? combatant?.ac ?? '—'} />
          {passivePerception !== null && <StatPill label="PP" value={passivePerception} />}
          {profile?.spell_save_dc > 0 && <StatPill label="Spell DC" value={profile.spell_save_dc} />}
          {!!profile?.spell_attack_bonus && <StatPill label="Spell ATK" value={`+${profile.spell_attack_bonus}`} />}
        </div>

        {resourceConfigs.length > 0 && (
          <ResourceSection
            resources={resourceConfigs}
            state={state}
            readOnly={readOnly}
            onUpdateFields={updateResourceFields}
          />
        )}

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

        {profile && (
          <SpellSlotGrid
            profile={profile}
            state={state}
            readOnly={readOnly}
            canRestore={canRestore}
            onUpdate={onUpdate}
          />
        )}

        <ConditionChipRow
          conditions={state?.conditions || []}
          concentration={concentration}
          stateId={state?.id}
          readOnly={readOnly}
          onUpdate={onUpdate}
        />

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

        {profile?.wildshape_enabled && state && (
          <WildShapeBlock state={state} readOnly={readOnly} canRestore={canRestore} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
}

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

function ResourceSection({ resources, state, readOnly, onUpdateFields }) {
  return (
    <div className="player-resource-section" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Resources
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {resources.map(resource => (
          <ResourceRow
            key={resource.id}
            resource={resource}
            state={state}
            readOnly={readOnly}
            onUpdateFields={onUpdateFields}
          />
        ))}
      </div>
    </div>
  );
}

function ResourceRow({ resource, state, readOnly, onUpdateFields }) {
  if (resource.type === 'toggle') {
    const value = readBooleanField(state, [resource.boolKey], false);
    const canToggle = !readOnly;

    async function handleToggle() {
      if (!canToggle) return;
      await onUpdateFields({ [resource.boolKey]: !value });
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{resource.label}</span>
          {resource.meta ? (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{resource.meta}</span>
          ) : null}
        </div>

        {canToggle ? (
          <button
            className="btn btn-ghost"
            style={{
              fontSize: 11,
              padding: '4px 10px',
              borderColor: value ? 'var(--accent-green)' : 'var(--accent-red)',
              color: value ? 'var(--accent-green)' : 'var(--accent-red)',
            }}
            onClick={handleToggle}
          >
            {value ? (resource.trueLabel || 'Used') : (resource.falseLabel || 'Ready')}
          </button>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 700, color: value ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {value ? (resource.trueLabel || 'Used') : (resource.falseLabel || 'Ready')}
          </span>
        )}
      </div>
    );
  }

  const current = readNumberField(state, [resource.currentKey], 0);
  const max = readNumberField(state, [resource.maxKey], null);

  if (resource.type === 'counter') {
    const upperBound = max ?? Math.max(current, 0);

    async function adjust(delta) {
      if (readOnly) return;
      const next = Math.max(0, Math.min(upperBound, current + delta));
      if (next === current) return;
      await onUpdateFields({ [resource.currentKey]: next });
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{resource.label}</span>
          {(resource.meta || resource.displaySuffix) ? (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {[resource.meta, resource.displaySuffix].filter(Boolean).join(' • ')}
            </span>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!readOnly && (
            <button className="btn btn-icon btn-ghost" style={{ minWidth: 28, minHeight: 28, fontSize: 13 }} onClick={() => adjust(-1)}>−</button>
          )}
          <span style={{ minWidth: 54, textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
            {current}{max !== null ? ` / ${max}` : ''}
          </span>
          {!readOnly && (
            <button className="btn btn-icon btn-ghost" style={{ minWidth: 28, minHeight: 28, fontSize: 13 }} onClick={() => adjust(1)}>+</button>
          )}
        </div>
      </div>
    );
  }

  const safeMax = Math.max(0, max ?? current ?? 0);
  const safeCurrent = Math.max(0, Math.min(safeMax, current ?? 0));

  async function setPips(nextCurrent) {
    if (readOnly) return;
    const clamped = Math.max(0, Math.min(safeMax, nextCurrent));
    await onUpdateFields({ [resource.currentKey]: clamped });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{resource.label}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {[resource.meta, `${safeCurrent}/${safeMax}`].filter(Boolean).join(' • ')}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {Array.from({ length: safeMax }).map((_, i) => {
          const active = i < safeCurrent;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setPips(active ? i : i + 1)}
              disabled={readOnly}
              title={readOnly ? undefined : active ? 'Spend / reduce' : 'Restore / add'}
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                padding: 0,
                border: `2px solid ${active ? 'var(--accent-blue)' : 'var(--border-strong)'}`,
                background: active ? 'var(--accent-blue)' : 'transparent',
                cursor: readOnly ? 'default' : 'pointer',
                opacity: readOnly ? 0.9 : 1,
              }}
            />
          );
        })}
        {safeMax === 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No charges</span>
        )}
      </div>
    </div>
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
  const n = parseInt(val, 10);
  if (Number.isNaN(n)) return '—';
  return n >= 0 ? `+${n}` : `${n}`;
}

function HpEditableNumber({ value, onSet }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef(null);

  useEffect(() => { if (!editing) setDraft(String(value)); }, [value, editing]);

  function commit() {
    setEditing(false);
    const n = parseInt(draft, 10);
    if (!Number.isNaN(n) && n !== value) onSet(n);
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
      onBlur={() => { setEditing(false); const n = parseInt(draft, 10); if (!Number.isNaN(n)) onSet(n); }}
      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(false); }}
      autoFocus
    />
  );
}
