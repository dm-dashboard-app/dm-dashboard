import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { getStandardSlotState, getPactSlotState, spendSpellSlotWithChoice } from '../utils/spellSlotMutations';

function readBool(obj, keys, fallback = false) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj || {}, key)) return !!obj[key];
  }
  return fallback;
}

function readText(obj, keys, fallback = '') {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== '') return String(value);
  }
  return fallback;
}

function readNumber(obj, keys, fallback = 0) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== '') {
      const n = parseInt(value, 10);
      if (Number.isFinite(n)) return n;
    }
  }
  return fallback;
}

function normalizeClassTags(raw) {
  if (Array.isArray(raw)) return raw.map(v => String(v).trim()).filter(Boolean);
  if (!raw) return [];
  return String(raw).split(',').map(v => v.trim()).filter(Boolean);
}

function getSpellRecord(row = {}) {
  const spell = row.spells || row.spell || {};
  const name = readText(spell, ['name'], 'Unnamed Spell');
  const level = readNumber(spell, ['level'], 0);
  const concentration = readBool(spell, ['concentration', 'is_concentration'], false);
  const classTags = normalizeClassTags(spell.class_tags || spell.class_tag_list || spell.classes);
  const prepared = readBool(row, ['is_prepared', 'prepared'], false);
  const known = readBool(row, ['is_known', 'known'], true);
  return {
    rowId: row.id,
    spellId: row.spell_id || spell.id,
    name,
    level,
    concentration,
    classTags,
    prepared,
    known,
  };
}

function slotSummary(state = {}, profile = {}) {
  const parts = [];
  for (let level = 1; level <= 9; level += 1) {
    const standard = getStandardSlotState(profile, state, level);
    if (standard.max > 0) parts.push(`L${level} ${standard.available}/${standard.max}`);
  }
  const pact = getPactSlotState(state, 1);
  if (pact.max > 0) parts.push(`Pact L${pact.level} ${pact.current}/${pact.max}`);
  return parts.join(' • ');
}

async function setConcentrationSpell(stateId, encounterId, spellId, spellName, actor = 'Player') {
  const updates = {
    concentration: true,
    concentration_spell_id: spellId || null,
    concentration_check_dc: null,
  };
  await supabase.from('player_encounter_state').update(updates).eq('id', stateId);
  if (encounterId) {
    await supabase.from('combat_log').insert({
      encounter_id: encounterId,
      actor,
      action: 'con',
      detail: spellName ? `Concentration started: ${spellName}` : 'Concentration started',
    });
  }
}

async function clearConcentrationSpell(stateId, encounterId, spellName = '', actor = 'Player') {
  await supabase.from('player_encounter_state').update({
    concentration: false,
    concentration_spell_id: null,
    concentration_check_dc: null,
  }).eq('id', stateId);
  if (encounterId) {
    await supabase.from('combat_log').insert({
      encounter_id: encounterId,
      actor,
      action: 'con',
      detail: spellName ? `Concentration ended: ${spellName}` : 'Concentration ended',
    });
  }
}

export default function SpellbookPanel({ profile, state, encounterId, onUpdate, role = 'player' }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('prepared');
  const [castingId, setCastingId] = useState(null);
  const actorName = role === 'dm' ? 'DM' : (profile?.name || 'Player');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!profile?.id) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from('profile_player_spells')
        .select('*, spells(*)')
        .eq('player_profile_id', profile.id)
        .order('spell_id', { ascending: true });
      if (!cancelled) {
        setRows((data || []).map(getSpellRecord).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)));
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [profile?.id]);

  const displayed = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'concentration') return rows.filter(row => row.concentration);
    return rows.filter(row => row.prepared || row.level === 0);
  }, [rows, filter]);

  async function castSpell(spell) {
    if (!state?.id) return;
    setCastingId(spell.rowId);
    try {
      if (spell.level > 0) {
        const standard = getStandardSlotState(profile, state, spell.level);
        const pact = getPactSlotState(state, spell.level);
        let preferPact = null;

        if (pact.canSpend && standard.canSpend) {
          preferPact = window.confirm(`Use a Warlock pact slot for ${spell.name}?\n\nOK = Pact slot\nCancel = Standard slot`);
        }

        await spendSpellSlotWithChoice({
          stateId: state.id,
          profile,
          state,
          level: spell.level,
          preferPact,
        });
      }

      if (spell.concentration) {
        await setConcentrationSpell(state.id, encounterId, spell.spellId, spell.name, actorName);
      }

      if (encounterId) {
        await supabase.from('combat_log').insert({
          encounter_id: encounterId,
          actor: actorName,
          action: 'cast',
          detail: `${profile?.name || 'Player'} cast ${spell.name}${spell.level > 0 ? ` (L${spell.level})` : ' (Cantrip)'}`,
        });
      }

      onUpdate?.();
    } finally {
      setCastingId(null);
    }
  }

  async function togglePrepared(row) {
    const next = !row.prepared;
    await supabase.from('profile_player_spells').update({ is_prepared: next }).eq('id', row.rowId);
    setRows(current => current.map(item => item.rowId === row.rowId ? { ...item, prepared: next } : item));
  }

  const concentrationSpellName = rows.find(row => row.spellId === state?.concentration_spell_id)?.name || '';

  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <div className="panel-title">Spellbook</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {[
          ['prepared', 'Prepared'],
          ['concentration', 'Concentration'],
          ['all', 'All'],
        ].map(([value, label]) => (
          <button key={value} className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px', borderColor: filter === value ? 'var(--accent-blue)' : 'var(--border)', color: filter === value ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => setFilter(value)}>{label}</button>
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
        {slotSummary(state, profile) || 'No spell slots'}
      </div>

      {state?.concentration && (
        <div style={{ fontSize: 11, color: 'var(--accent-gold)', marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Concentrating{concentrationSpellName ? ` on ${concentrationSpellName}` : ''}</span>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '1px 6px' }} onClick={() => clearConcentrationSpell(state.id, encounterId, concentrationSpellName, actorName).then(() => onUpdate?.())}>End</button>
        </div>
      )}

      {loading && <div className="empty-state">Loading spells…</div>}
      {!loading && displayed.length === 0 && <div className="empty-state">No spells in this view yet.</div>}

      {!loading && displayed.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayed.map(spell => (
            <div key={spell.rowId} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{spell.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}
                    {spell.concentration ? ' • Concentration' : ''}
                    {spell.classTags.length > 0 ? ` • ${spell.classTags.join(', ')}` : ''}
                  </div>
                </div>
                {role === 'dm' && (
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => togglePrepared(spell)}>
                    {spell.prepared ? 'Prepared' : 'Unprepared'}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => castSpell(spell)} disabled={castingId === spell.rowId}>
                  {castingId === spell.rowId ? 'Casting…' : 'Cast'}
                </button>
                {spell.concentration && state?.concentration_spell_id !== spell.spellId && (
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setConcentrationSpell(state.id, encounterId, spell.spellId, spell.name, actorName).then(() => onUpdate?.())}>
                    Set Concentration
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
