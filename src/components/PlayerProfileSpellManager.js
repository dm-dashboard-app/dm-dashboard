import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { getClassLevel } from '../utils/classResources';
import {
  SPELL_FILTER_LEVELS,
  SPELL_FILTER_PRIMARY,
  createSpellFilterState,
  spellMatchesFilterState,
  toggleSpellFilter,
} from '../utils/spellWorkflow';

const FULL_CASTER_CLASSES = ['bard', 'cleric', 'druid', 'sorcerer', 'wizard'];
const HALF_CASTER_CLASSES = ['paladin', 'ranger'];
const PACT_CASTER_CLASSES = ['warlock'];
const PREPARED_CLASSES = ['cleric', 'druid', 'paladin'];
const KNOWN_CLASSES = ['bard', 'ranger', 'sorcerer', 'warlock'];

function normalizeClassName(name) {
  return String(name || '').trim().toLowerCase();
}

function titleCase(name) {
  const value = String(name || '');
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

function getTotalLevel(profile = {}) {
  return Math.max(0, Number(profile.class_level || 0)) + Math.max(0, Number(profile.class_level_2 || 0));
}

function getProficiencyBonus(level) {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
}

function getSpellcastingModifier(profile = {}) {
  const totalLevel = getTotalLevel(profile);
  const proficiency = getProficiencyBonus(totalLevel);
  const dc = Number(profile.spell_save_dc || 0);
  if (!dc) return 0;
  return Math.max(-5, dc - 8 - proficiency);
}

function getCasterMode(className) {
  if (className === 'wizard') return 'wizard';
  if (PREPARED_CLASSES.includes(className)) return 'prepared';
  if (KNOWN_CLASSES.includes(className)) return 'known';
  return 'manual';
}

function getMaxSpellLevelForClass(className, classLevel) {
  const level = Number(classLevel || 0);
  if (level <= 0) return 0;
  if (FULL_CASTER_CLASSES.includes(className)) {
    if (level >= 17) return 9;
    if (level >= 15) return 8;
    if (level >= 13) return 7;
    if (level >= 11) return 6;
    if (level >= 9) return 5;
    if (level >= 7) return 4;
    if (level >= 5) return 3;
    if (level >= 3) return 2;
    return 1;
  }
  if (HALF_CASTER_CLASSES.includes(className)) {
    if (level < 2) return 0;
    if (level >= 17) return 5;
    if (level >= 13) return 4;
    if (level >= 9) return 3;
    if (level >= 5) return 2;
    return 1;
  }
  if (PACT_CASTER_CLASSES.includes(className)) {
    if (level >= 9) return 5;
    if (level >= 7) return 4;
    if (level >= 5) return 3;
    if (level >= 3) return 2;
    return 1;
  }
  return 0;
}

function getPreparedCap(profile = {}, className, classLevel) {
  const level = Number(classLevel || 0);
  const spellMod = getSpellcastingModifier(profile);
  if (className === 'paladin') return Math.max(1, Math.floor(level / 2) + spellMod);
  if (className === 'cleric' || className === 'druid' || className === 'wizard') return Math.max(1, level + spellMod);
  return 0;
}

function getClassEntries(profile = {}) {
  const entries = [];
  const primaryClass = normalizeClassName(profile.class_name);
  const secondaryClass = normalizeClassName(profile.class_name_2);
  if (primaryClass) {
    const primaryLevel = getClassLevel(profile, primaryClass);
    entries.push({
      key: primaryClass,
      className: primaryClass,
      label: titleCase(primaryClass),
      level: primaryLevel,
      mode: getCasterMode(primaryClass),
      maxSpellLevel: getMaxSpellLevelForClass(primaryClass, primaryLevel),
      prepCap: getPreparedCap(profile, primaryClass, primaryLevel),
    });
  }
  if (secondaryClass && secondaryClass !== primaryClass) {
    const secondaryLevel = getClassLevel(profile, secondaryClass);
    entries.push({
      key: secondaryClass,
      className: secondaryClass,
      label: titleCase(secondaryClass),
      level: secondaryLevel,
      mode: getCasterMode(secondaryClass),
      maxSpellLevel: getMaxSpellLevelForClass(secondaryClass, secondaryLevel),
      prepCap: getPreparedCap(profile, secondaryClass, secondaryLevel),
    });
  }
  return entries.filter(entry => entry.level > 0);
}

function getSpellSummary(spell = {}) {
  return [spell.school, spell.casting_time, spell.range_text, spell.duration_text].filter(Boolean).join(' • ');
}

function getSpellRowMap(rows = []) {
  return Object.fromEntries((rows || []).map(row => [row.spell_id, row]));
}

function spellMatchesClass(spell, className) {
  return (spell.class_tags || []).includes(className);
}

function spellIsLegalForClass(spell, classEntry) {
  if (!spellMatchesClass(spell, classEntry.className)) return false;
  if (Number(spell.level) === 0) return true;
  return Number(spell.level) <= Number(classEntry.maxSpellLevel || 0);
}

function SpellDetailModal({ spell, onClose }) {
  if (!spell) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="panel" style={{ width: 'min(680px, 100%)', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <span>{spell.name}</span>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={onClose}>Close</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
          {Number(spell.level) === 0 ? 'Cantrip' : `Level ${spell.level}`} • {spell.school || 'Unknown school'}
          {spell.concentration ? ' • Concentration' : ''}
          {spell.ritual ? ' • Ritual' : ''}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'grid', gap: 4 }}>
          <div><strong>Casting Time:</strong> {spell.casting_time || '—'}</div>
          <div><strong>Range:</strong> {spell.range_text || '—'}</div>
          <div><strong>Duration:</strong> {spell.duration_text || '—'}</div>
          <div><strong>Components:</strong> {spell.components_text || '—'}{spell.material_text ? ` (${spell.material_text})` : ''}</div>
          <div><strong>Classes:</strong> {(spell.class_tags || []).join(', ') || '—'}</div>
        </div>
        <div style={{ marginTop: 12, whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text-primary)' }}>{spell.description || 'No description available yet.'}</div>
        {spell.higher_level && <div style={{ marginTop: 12, whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text-secondary)' }}><strong>At Higher Levels:</strong>{' '}{spell.higher_level}</div>}
      </div>
    </div>
  );
}

function SpellRow({ spell, row, classEntry, cantripView, onToggleCantrip, onLearn, onForget, onPrepare, onUnprepare, onOpenDetail }) {
  const isAssigned = !!row;
  const isPrepared = !!row?.is_prepared;
  const summary = getSpellSummary(spell);

  let actions = null;
  if (cantripView) {
    actions = <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => onToggleCantrip(spell, !isAssigned)}>{isAssigned ? 'Remove' : 'Add'}</button>;
  } else if (classEntry.mode === 'prepared') {
    actions = <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => (isPrepared ? onUnprepare(spell, row) : onPrepare(spell, row))}>{isPrepared ? 'Unprepare' : 'Prepare'}</button>;
  } else if (classEntry.mode === 'wizard') {
    actions = <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{isAssigned ? <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => onForget(spell, row)}>Forget</button> : <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => onLearn(spell)}>Learn</button>}{isAssigned && <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => (isPrepared ? onUnprepare(spell, row) : onPrepare(spell, row))}>{isPrepared ? 'Unprepare' : 'Prepare'}</button>}</div>;
  } else if (classEntry.mode === 'known') {
    actions = isAssigned ? <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => onForget(spell, row)}>Unlearn</button> : <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => onLearn(spell)}>Learn</button>;
  } else {
    actions = isAssigned ? <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => onForget(spell, row)}>Remove</button> : <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => onLearn(spell)}>Add</button>;
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <button type="button" className="btn btn-ghost" style={{ padding: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', border: 'none', background: 'transparent' }} onClick={() => onOpenDetail(spell)}>{spell.name}</button>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Number(spell.level) === 0 ? 'Cantrip' : `Level ${spell.level}`}{summary ? ` • ${summary}` : ''}</div>
          {isAssigned && <div style={{ fontSize: 10, color: 'var(--accent-blue)' }}>{classEntry.mode === 'prepared' ? (isPrepared ? 'Prepared' : 'Available') : (classEntry.mode === 'wizard' ? (isPrepared ? 'Learned • Prepared' : 'Learned') : 'Learned')}</div>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{actions}</div>
      </div>
    </div>
  );
}

export default function PlayerProfileSpellManager({ profile }) {
  const [spells, setSpells] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classKey, setClassKey] = useState('all');
  const [view, setView] = useState('all');
  const [filterState, setFilterState] = useState(createSpellFilterState());
  const [selectedSpell, setSelectedSpell] = useState(null);
  const classEntries = useMemo(() => getClassEntries(profile), [profile]);
  const activeClass = useMemo(() => classEntries.find(entry => entry.key === classKey) || classEntries[0] || null, [classEntries, classKey]);
  const rowMap = useMemo(() => getSpellRowMap(rows), [rows]);

  useEffect(() => {
    if (!classEntries.length) return;
    if (classKey !== 'all' && !classEntries.some(entry => entry.key === classKey)) {
      setClassKey('all');
    }
  }, [classEntries, classKey]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!profile?.id) {
        setLoading(false);
        setSpells([]);
        setRows([]);
        return;
      }
      setLoading(true);
      const [spellsRes, rowsRes] = await Promise.all([
        supabase.from('spells').select('*').order('level').order('name'),
        supabase.from('profile_player_spells').select('*').eq('player_profile_id', profile.id),
      ]);
      if (cancelled) return;
      setSpells(spellsRes.data || []);
      setRows(rowsRes.data || []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [profile?.id]);

  useEffect(() => {
    if (!activeClass) return;
    if (activeClass.mode === 'prepared') setView('all');
    else if (activeClass.mode === 'wizard') setView('learned');
    else if (activeClass.mode === 'known') setView('learned');
    else setView('all');
    setFilterState(createSpellFilterState());
    // intentionally runs only when the user changes the class scope;
    // avoid resetting level filters on background state refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classKey]);

  const legalSpells = useMemo(() => {
    if (!classEntries.length) return [];
    if (classKey === 'all') {
      return spells.filter(spell => classEntries.some(entry => spellIsLegalForClass(spell, entry)));
    }
    if (!activeClass) return [];
    return spells.filter(spell => spellIsLegalForClass(spell, activeClass));
  }, [spells, activeClass, classEntries, classKey]);

  const cantrips = useMemo(() => legalSpells.filter(spell => Number(spell.level) === 0), [legalSpells]);
  const leveledSpells = useMemo(() => legalSpells.filter(spell => Number(spell.level) > 0), [legalSpells]);

  const preparedCount = useMemo(() => {
    if (!activeClass) return 0;
    return leveledSpells.filter(spell => {
      const row = rowMap[spell.id];
      return !!row?.is_prepared;
    }).length;
  }, [activeClass, leveledSpells, rowMap]);

  const visibleLeveled = useMemo(() => {
    if (!activeClass) return [];
    if (activeClass.mode === 'prepared') {
      if (view === 'prepared') return leveledSpells.filter(spell => !!rowMap[spell.id]?.is_prepared);
      return leveledSpells;
    }
    if (activeClass.mode === 'wizard') {
      if (view === 'prepared') return leveledSpells.filter(spell => !!rowMap[spell.id]?.is_prepared);
      if (view === 'unlearned') return leveledSpells.filter(spell => !rowMap[spell.id]);
      return leveledSpells.filter(spell => !!rowMap[spell.id]);
    }
    if (activeClass.mode === 'known') {
      if (view === 'unlearned') return leveledSpells.filter(spell => !rowMap[spell.id]);
      return leveledSpells.filter(spell => !!rowMap[spell.id]);
    }
    return leveledSpells;
  }, [activeClass, leveledSpells, rowMap, view]);

  const filteredCantrips = useMemo(
    () => cantrips.filter(spell => spellMatchesFilterState(spell, filterState)),
    [cantrips, filterState],
  );

  const filteredVisibleLeveled = useMemo(
    () => visibleLeveled.filter(spell => spellMatchesFilterState(spell, filterState)),
    [visibleLeveled, filterState],
  );

  async function refreshRows() {
    if (!profile?.id) return;
    const { data } = await supabase.from('profile_player_spells').select('*').eq('player_profile_id', profile.id);
    setRows(data || []);
  }

  async function ensureRow(spell, patch = {}) {
    const existing = rowMap[spell.id];
    if (existing?.id) {
      await supabase.from('profile_player_spells').update(patch).eq('id', existing.id);
      await refreshRows();
      return;
    }
    await supabase.from('profile_player_spells').insert({ player_profile_id: profile.id, spell_id: spell.id, is_known: true, is_prepared: false, ...patch });
    await refreshRows();
  }

  async function deleteRow(row) {
    if (!row?.id) return;
    await supabase.from('profile_player_spells').delete().eq('id', row.id);
    await refreshRows();
  }

  async function toggleCantrip(spell, nextAssigned) {
    if (nextAssigned) await ensureRow(spell, { is_known: true, is_prepared: false });
    else await deleteRow(rowMap[spell.id]);
  }

  async function learnSpell(spell) {
    await ensureRow(spell, { is_known: true, is_prepared: false });
  }

  async function forgetSpell(spell, row) {
    await deleteRow(row || rowMap[spell.id]);
  }

  async function prepareSpell(spell, row) {
    if (activeClass?.prepCap > 0 && preparedCount >= activeClass.prepCap) {
      window.alert(`Prepared spell limit reached for ${activeClass.label}.`);
      return;
    }
    await ensureRow(spell, { is_known: true, is_prepared: true });
  }

  async function unprepareSpell(spell, row) {
    if (activeClass?.mode === 'prepared') {
      if (row?.id) {
        await supabase.from('profile_player_spells').update({ is_prepared: false }).eq('id', row.id);
        await refreshRows();
      }
      return;
    }
    if (row?.id) {
      await supabase.from('profile_player_spells').update({ is_prepared: false }).eq('id', row.id);
      await refreshRows();
    }
  }

  if (!profile?.id) return <div className="panel" style={{ marginTop: 12 }}><div className="panel-title">Spells</div><div className="empty-state">Save the player profile first, then manage spells here.</div></div>;
  if (loading) return <div className="panel" style={{ marginTop: 12 }}><div className="panel-title">Spells</div><div className="empty-state">Loading spells…</div></div>;
  if (classEntries.length === 0) return <div className="panel" style={{ marginTop: 12 }}><div className="panel-title">Spells</div><div className="empty-state">Add a spellcasting class to this profile to manage spells here.</div></div>;

  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <div className="panel-title">Spells</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px', borderColor: classKey === 'all' ? 'var(--accent-blue)' : 'var(--border)', color: classKey === 'all' ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => setClassKey('all')}>All Classes</button>
        {classEntries.map(entry => <button type="button" key={entry.key} className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px', borderColor: classKey === entry.key ? 'var(--accent-blue)' : 'var(--border)', color: classKey === entry.key ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => setClassKey(entry.key)}>{entry.label} Lv {entry.level}</button>)}
      </div>
      {activeClass && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            Legal spells shown for {classKey === 'all' ? 'all classes' : activeClass.label}. Max spell level: {classKey === 'all' ? 'per class limits applied' : (activeClass.maxSpellLevel || 'Cantrips only')}.
            {activeClass.mode === 'prepared' || activeClass.mode === 'wizard' ? ` Prepared ${preparedCount}/${activeClass.prepCap || 0}.` : ''}
            {' '}Cantrips are manual and uncapped.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {SPELL_FILTER_PRIMARY.map(item => (
              <button
                type="button"
                key={item.value}
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: '2px 8px', borderColor: (filterState.primary || ['all']).includes(item.value) ? 'var(--accent-blue)' : 'var(--border)', color: (filterState.primary || ['all']).includes(item.value) ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
                onClick={() => setFilterState(current => toggleSpellFilter(current, item.value))}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {SPELL_FILTER_LEVELS.map(item => (
              <button
                type="button"
                key={item.value}
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: '2px 8px', borderColor: filterState.level === item.value ? 'var(--accent-blue)' : 'var(--border)', color: filterState.level === item.value ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
                onClick={() => setFilterState(current => toggleSpellFilter(current, item.value))}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="panel-title" style={{ marginTop: 0 }}>Cantrips</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {filteredCantrips.map(spell => <SpellRow key={spell.id} spell={spell} row={rowMap[spell.id]} classEntry={activeClass} cantripView onToggleCantrip={toggleCantrip} onLearn={learnSpell} onForget={forgetSpell} onPrepare={prepareSpell} onUnprepare={unprepareSpell} onOpenDetail={setSelectedSpell} />)}
            {filteredCantrips.length === 0 && <div className="empty-state">No cantrips match current filters.</div>}
          </div>
          <div className="panel-title">Leveled Spells</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {activeClass.mode === 'prepared' && <><button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px', borderColor: view === 'all' ? 'var(--accent-blue)' : 'var(--border)', color: view === 'all' ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => setView('all')}>All</button><button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px', borderColor: view === 'prepared' ? 'var(--accent-blue)' : 'var(--border)', color: view === 'prepared' ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => setView('prepared')}>Prepared</button></>}
            {activeClass.mode === 'wizard' && <><button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px', borderColor: view === 'learned' ? 'var(--accent-blue)' : 'var(--border)', color: view === 'learned' ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => setView('learned')}>Learned</button><button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px', borderColor: view === 'unlearned' ? 'var(--accent-blue)' : 'var(--border)', color: view === 'unlearned' ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => setView('unlearned')}>Unlearned</button><button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px', borderColor: view === 'prepared' ? 'var(--accent-blue)' : 'var(--border)', color: view === 'prepared' ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => setView('prepared')}>Prepared</button></>}
            {activeClass.mode === 'known' && <><button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px', borderColor: view === 'learned' ? 'var(--accent-blue)' : 'var(--border)', color: view === 'learned' ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => setView('learned')}>Learned</button><button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px', borderColor: view === 'unlearned' ? 'var(--accent-blue)' : 'var(--border)', color: view === 'unlearned' ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => setView('unlearned')}>Unlearned</button></>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredVisibleLeveled.map(spell => <SpellRow key={spell.id} spell={spell} row={rowMap[spell.id]} classEntry={activeClass} onToggleCantrip={toggleCantrip} onLearn={learnSpell} onForget={forgetSpell} onPrepare={prepareSpell} onUnprepare={unprepareSpell} onOpenDetail={setSelectedSpell} />)}
            {filteredVisibleLeveled.length === 0 && <div className="empty-state">No spells match current filters/view.</div>}
          </div>
        </>
      )}
      <SpellDetailModal spell={selectedSpell} onClose={() => setSelectedSpell(null)} />
    </div>
  );
}
