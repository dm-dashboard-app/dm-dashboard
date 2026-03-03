import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ManagementScreens() {
  const [tab, setTab] = useState('players');

  return (
    <div className="panel">
      <div className="panel-title">Manage</div>
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'players' ? 'active' : ''}`} onClick={() => setTab('players')}>Players</button>
        <button className={`tab-btn ${tab === 'monsters' ? 'active' : ''}`} onClick={() => setTab('monsters')}>Monsters</button>
        <button className={`tab-btn ${tab === 'wildshape' ? 'active' : ''}`} onClick={() => setTab('wildshape')}>Wild Shape</button>
      </div>
      {tab === 'players'   && <PlayerProfileManager />}
      {tab === 'monsters'  && <MonsterTemplateManager />}
      {tab === 'wildshape' && <WildShapeLibrary />}
    </div>
  );
}

// ============================================================
// PLAYER PROFILE MANAGER
// ============================================================
function PlayerProfileManager() {
  const [profiles, setProfiles] = useState([]);
  const [editing, setEditing] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('profiles_players').select('*').order('name');
    setProfiles(data || []);
  }

  async function save(profile) {
    if (profile.id) {
      await supabase.from('profiles_players').update(profile).eq('id', profile.id);
    } else {
      await supabase.from('profiles_players').insert(profile);
    }
    setEditing(null);
    load();
  }

  async function remove(id) {
    await supabase.from('profiles_players').delete().eq('id', id);
    load();
  }

  if (editing !== null) {
    return <PlayerProfileForm initial={editing} onSave={save} onCancel={() => setEditing(null)} />;
  }

  return (
    <div>
      {profiles.map(p => (
        <div key={p.id} className="manage-row">
          <span>{p.name}</span>
          <div className="form-row">
            <button className="btn btn-ghost" onClick={() => setEditing(p)}>Edit</button>
            <button className="btn btn-danger" onClick={() => remove(p.id)}>Delete</button>
          </div>
        </div>
      ))}
      <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setEditing({})}>
        + New Player
      </button>
    </div>
  );
}

function PlayerProfileForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState({
    name: '', max_hp: 10, ac: 10,
    save_str: 0, save_dex: 0, save_con: 0, save_int: 0, save_wis: 0, save_cha: 0,
    spell_save_dc: 8, spell_attack_bonus: 0,
    skill_perception: 0, skill_insight: 0, skill_survival: 0,
    slots_max_1: 0, slots_max_2: 0, slots_max_3: 0, slots_max_4: 0, slots_max_5: 0,
    slots_max_6: 0, slots_max_7: 0, slots_max_8: 0, slots_max_9: 0,
    wildshape_enabled: false,
    ...initial,
  });

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const num = (k, v) => set(k, parseInt(v) || 0);

  return (
    <div className="profile-form">
      <Field label="Name"><input className="form-input" value={f.name} onChange={e => set('name', e.target.value)} /></Field>
      <Field label="Max HP"><input className="form-input" type="number" value={f.max_hp} onChange={e => num('max_hp', e.target.value)} /></Field>
      <Field label="AC"><input className="form-input" type="number" value={f.ac} onChange={e => num('ac', e.target.value)} /></Field>
      <Field label="Spell Save DC"><input className="form-input" type="number" value={f.spell_save_dc} onChange={e => num('spell_save_dc', e.target.value)} /></Field>
      <Field label="Spell Attack Bonus"><input className="form-input" type="number" value={f.spell_attack_bonus} onChange={e => num('spell_attack_bonus', e.target.value)} /></Field>

      <div className="panel-title" style={{ marginTop: 12 }}>Saving Throws</div>
      <div className="saves-grid">
        {['str','dex','con','int','wis','cha'].map(s => (
          <div key={s} className="form-group">
            <label className="form-label">{s.toUpperCase()}</label>
            <input className="form-input" type="number" value={f[`save_${s}`]} onChange={e => num(`save_${s}`, e.target.value)} />
          </div>
        ))}
      </div>

      <div className="panel-title" style={{ marginTop: 12 }}>Skills</div>
      {['perception','insight','survival'].map(sk => (
        <Field key={sk} label={sk.charAt(0).toUpperCase()+sk.slice(1)}>
          <input className="form-input" type="number" value={f[`skill_${sk}`]} onChange={e => num(`skill_${sk}`, e.target.value)} />
        </Field>
      ))}

      <div className="panel-title" style={{ marginTop: 12 }}>Spell Slots (max per level)</div>
      <div className="saves-grid">
        {[1,2,3,4,5,6,7,8,9].map(l => (
          <div key={l} className="form-group">
            <label className="form-label">L{l}</label>
            <input className="form-input" type="number" value={f[`slots_max_${l}`]} onChange={e => num(`slots_max_${l}`, e.target.value)} />
          </div>
        ))}
      </div>

      <label className="checkbox-row" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={f.wildshape_enabled} onChange={e => set('wildshape_enabled', e.target.checked)} />
        <span>Wild Shape Enabled</span>
      </label>

      <div className="form-row" style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={() => onSave(f)} disabled={!f.name}>Save</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ============================================================
// MONSTER TEMPLATE MANAGER
// ============================================================
function MonsterTemplateManager() {
  const [monsters, setMonsters] = useState([]);
  const [editing, setEditing] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('profiles_monsters').select('*').order('name');
    setMonsters(data || []);
  }

  async function save(m) {
    if (m.id) {
      await supabase.from('profiles_monsters').update(m).eq('id', m.id);
    } else {
      await supabase.from('profiles_monsters').insert(m);
    }
    setEditing(null);
    load();
  }

  async function remove(id) {
    await supabase.from('profiles_monsters').delete().eq('id', id);
    load();
  }

  if (editing !== null) {
    return <MonsterForm initial={editing} onSave={save} onCancel={() => setEditing(null)} />;
  }

  return (
    <div>
      {monsters.map(m => (
        <div key={m.id} className="manage-row">
          <span>{m.name} — AC {m.ac}, HP {m.hp_max}</span>
          <div className="form-row">
            <button className="btn btn-ghost" onClick={() => setEditing(m)}>Edit</button>
            <button className="btn btn-danger" onClick={() => remove(m.id)}>Delete</button>
          </div>
        </div>
      ))}
      <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setEditing({})}>
        + New Monster
      </button>
    </div>
  );
}

function MonsterForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState({ name: '', ac: 10, hp_max: 10, initiative_mod: 0, notes: '', ...initial });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  return (
    <div className="profile-form">
      <Field label="Name"><input className="form-input" value={f.name} onChange={e => set('name', e.target.value)} /></Field>
      <Field label="AC"><input className="form-input" type="number" value={f.ac} onChange={e => set('ac', parseInt(e.target.value)||0)} /></Field>
      <Field label="HP Max"><input className="form-input" type="number" value={f.hp_max} onChange={e => set('hp_max', parseInt(e.target.value)||0)} /></Field>
      <Field label="Initiative Mod"><input className="form-input" type="number" value={f.initiative_mod} onChange={e => set('initiative_mod', parseInt(e.target.value)||0)} /></Field>
      <Field label="Notes (DM only)"><textarea className="form-input" value={f.notes||''} onChange={e => set('notes', e.target.value)} rows={2} /></Field>
      <div className="form-row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => onSave(f)} disabled={!f.name}>Save</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ============================================================
// WILD SHAPE LIBRARY
// ============================================================
function WildShapeLibrary() {
  const [forms, setForms] = useState([]);
  const [editing, setEditing] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('profiles_wildshape').select('*').order('form_name');
    setForms(data || []);
  }

  async function save(f) {
    if (f.id) {
      await supabase.from('profiles_wildshape').update(f).eq('id', f.id);
    } else {
      await supabase.from('profiles_wildshape').insert(f);
    }
    setEditing(null);
    load();
  }

  async function remove(id) {
    await supabase.from('profiles_wildshape').delete().eq('id', id);
    load();
  }

  if (editing !== null) {
    return <WildShapeForm initial={editing} onSave={save} onCancel={() => setEditing(null)} />;
  }

  return (
    <div>
      {forms.map(f => (
        <div key={f.id} className="manage-row">
          <span>{f.form_name} — AC {f.ac}, HP {f.hp_max}</span>
          <div className="form-row">
            <button className="btn btn-ghost" onClick={() => setEditing(f)}>Edit</button>
            <button className="btn btn-danger" onClick={() => remove(f.id)}>Delete</button>
          </div>
        </div>
      ))}
      <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setEditing({})}>
        + New Form
      </button>
    </div>
  );
}

function WildShapeForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState({
    form_name: '', ac: 10, hp_max: 10,
    save_str: 0, save_dex: 0, save_con: 0, save_int: 0, save_wis: 0, save_cha: 0,
    speed: '', notes: '',
    ...initial,
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const num = (k, v) => set(k, parseInt(v)||0);

  return (
    <div className="profile-form">
      <Field label="Form Name"><input className="form-input" value={f.form_name} onChange={e => set('form_name', e.target.value)} /></Field>
      <Field label="AC"><input className="form-input" type="number" value={f.ac} onChange={e => num('ac', e.target.value)} /></Field>
      <Field label="HP Max"><input className="form-input" type="number" value={f.hp_max} onChange={e => num('hp_max', e.target.value)} /></Field>
      <div className="panel-title" style={{ marginTop: 12 }}>Saving Throws</div>
      <div className="saves-grid">
        {['str','dex','con','int','wis','cha'].map(s => (
          <div key={s} className="form-group">
            <label className="form-label">{s.toUpperCase()}</label>
            <input className="form-input" type="number" value={f[`save_${s}`]} onChange={e => num(`save_${s}`, e.target.value)} />
          </div>
        ))}
      </div>
      <Field label="Speed (optional)"><input className="form-input" value={f.speed||''} onChange={e => set('speed', e.target.value)} /></Field>
      <Field label="Notes (optional)"><textarea className="form-input" value={f.notes||''} onChange={e => set('notes', e.target.value)} rows={2} /></Field>
      <div className="form-row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => onSave(f)} disabled={!f.form_name}>Save</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// Shared helper
function Field({ label, children }) {
  return (
    <div className="form-group" style={{ marginBottom: 8 }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}