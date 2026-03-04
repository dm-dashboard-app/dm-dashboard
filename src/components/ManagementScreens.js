import React, { useState, useEffect } from 'react';
import { supabase, uploadPortrait } from '../supabaseClient';

export default function ManagementScreens() {
  const [tab, setTab] = useState('players');

  return (
    <div className="panel">
      <div className="panel-title">Manage</div>
      <div className="tab-bar" style={{ position: 'static' }}>
        <button className={`tab-btn ${tab === 'players' ? 'active' : ''}`} onClick={() => setTab('players')}>Players</button>
        <button className={`tab-btn ${tab === 'monsters' ? 'active' : ''}`} onClick={() => setTab('monsters')}>Monsters & NPCs</button>
        <button className={`tab-btn ${tab === 'wildshape' ? 'active' : ''}`} onClick={() => setTab('wildshape')}>Wild Shape</button>
      </div>
      {tab === 'players'   && <PlayerProfileManager />}
      {tab === 'monsters'  && <MonsterTemplateManager />}
      {tab === 'wildshape' && <WildShapeLibrary />}
    </div>
  );
}

function NumInput({ value, onChange, ...props }) {
  const [draft, setDraft] = useState(value === 0 ? '' : String(value));

  useEffect(() => {
    setDraft(value === 0 ? '' : String(value));
  }, [value]);

  return (
    <input
      {...props}
      className="form-input"
      type="number"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => {
        const n = parseInt(draft);
        const final = isNaN(n) ? 0 : n;
        setDraft(final === 0 ? '' : String(final));
        onChange(final);
      }}
    />
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
    if (!window.confirm('Delete this player profile?')) return;
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
    initiative_mod: 0,
    save_str: 0, save_dex: 0, save_con: 0, save_int: 0, save_wis: 0, save_cha: 0,
    spell_save_dc: 8, spell_attack_bonus: 0,
    skill_perception: 0, skill_insight: 0, skill_investigation: 0, skill_survival: 0,
    slots_max_1: 0, slots_max_2: 0, slots_max_3: 0, slots_max_4: 0, slots_max_5: 0,
    slots_max_6: 0, slots_max_7: 0, slots_max_8: 0, slots_max_9: 0,
    wildshape_enabled: false,
    portrait_url: '',
    ...initial,
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  async function handlePortraitUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!f.name.trim()) {
      setUploadError('Enter the player name first before uploading a portrait.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadPortrait(file, f.name);
      set('portrait_url', url);
    } catch (err) {
      setUploadError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="profile-form">
      <Field label="Name">
        <input className="form-input" value={f.name} onChange={e => set('name', e.target.value)} />
      </Field>
      <Field label="Portrait">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {f.portrait_url && (
            <img src={f.portrait_url} alt="Portrait" style={{ width: 64, height: 80, objectFit: 'cover', borderRadius: 6 }} />
          )}
          <input type="file" accept="image/*" onChange={handlePortraitUpload} disabled={uploading} style={{ fontSize: 13 }} />
          {uploading && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Uploading…</span>}
          {uploadError && <span style={{ fontSize: 12, color: 'var(--accent-red)' }}>{uploadError}</span>}
        </div>
      </Field>
      <Field label="Max HP"><NumInput value={f.max_hp} onChange={v => set('max_hp', v)} /></Field>
      <Field label="AC"><NumInput value={f.ac} onChange={v => set('ac', v)} /></Field>
      <Field label="Initiative Mod (tiebreaker only — not added to rolls)">
        <NumInput value={f.initiative_mod ?? 0} onChange={v => set('initiative_mod', v)} />
      </Field>
      <Field label="Spell Save DC"><NumInput value={f.spell_save_dc} onChange={v => set('spell_save_dc', v)} /></Field>
      <Field label="Spell Attack Bonus"><NumInput value={f.spell_attack_bonus} onChange={v => set('spell_attack_bonus', v)} /></Field>
      <div className="panel-title" style={{ marginTop: 12 }}>Saving Throws</div>
      <div className="saves-grid">
        {['str','dex','con','int','wis','cha'].map(s => (
          <div key={s} className="form-group">
            <label className="form-label">{s.toUpperCase()}</label>
            <NumInput value={f[`save_${s}`]} onChange={v => set(`save_${s}`, v)} />
          </div>
        ))}
      </div>
      <div className="panel-title" style={{ marginTop: 12 }}>Skills</div>
      {['perception', 'insight', 'investigation', 'survival'].map(sk => (
        <Field key={sk} label={sk.charAt(0).toUpperCase() + sk.slice(1)}>
          <NumInput value={f[`skill_${sk}`] ?? 0} onChange={v => set(`skill_${sk}`, v)} />
        </Field>
      ))}
      <div className="panel-title" style={{ marginTop: 12 }}>Spell Slots (max per level)</div>
      <div className="saves-grid">
        {[1,2,3,4,5,6,7,8,9].map(l => (
          <div key={l} className="form-group">
            <label className="form-label">L{l}</label>
            <NumInput value={f[`slots_max_${l}`]} onChange={v => set(`slots_max_${l}`, v)} />
          </div>
        ))}
      </div>
      <label className="checkbox-row" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={f.wildshape_enabled} onChange={e => set('wildshape_enabled', e.target.checked)} />
        <span>Wild Shape Enabled</span>
      </label>
      <div className="form-row" style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={() => onSave(f)} disabled={!f.name || uploading}>Save</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ============================================================
// MONSTER / NPC TEMPLATE MANAGER
// ============================================================
function MonsterTemplateManager() {
  const [monsters, setMonsters] = useState([]);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('ALL');

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
    if (!window.confirm('Delete this template?')) return;
    await supabase.from('profiles_monsters').delete().eq('id', id);
    load();
  }

  if (editing !== null) {
    return <MonsterForm initial={editing} onSave={save} onCancel={() => setEditing(null)} />;
  }

  const filtered = filter === 'ALL' ? monsters : monsters.filter(m => m.side === filter);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, marginTop: 8 }}>
        {['ALL', 'ENEMY', 'NPC'].map(f => (
          <button key={f} className="btn btn-ghost"
            style={{ fontSize: 11, padding: '2px 10px', borderColor: filter === f ? 'var(--accent-blue)' : 'var(--border)', color: filter === f ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
            onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      {filtered.map(m => (
        <div key={m.id} className="manage-row">
          <span>
            <span className={`badge badge-${(m.side || 'ENEMY').toLowerCase()}`} style={{ marginRight: 6 }}>{m.side || 'ENEMY'}</span>
            {m.name} — AC {m.ac}, HP {m.hp_max}
          </span>
          <div className="form-row">
            <button className="btn btn-ghost" onClick={() => setEditing(m)}>Edit</button>
            <button className="btn btn-danger" onClick={() => remove(m.id)}>Delete</button>
          </div>
        </div>
      ))}
      <div className="form-row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => setEditing({ side: 'ENEMY' })}>+ New Enemy</button>
        <button className="btn btn-ghost" onClick={() => setEditing({ side: 'NPC' })}>+ New NPC</button>
      </div>
    </div>
  );
}

function MonsterForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState({ name: '', ac: 10, hp_max: 10, initiative_mod: 0, notes: '', side: 'ENEMY', ...initial });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  return (
    <div className="profile-form">
      <Field label="Type">
        <div style={{ display: 'flex', gap: 8 }}>
          {['ENEMY', 'NPC'].map(s => (
            <button key={s} className="btn btn-ghost"
              style={{ flex: 1, borderColor: f.side === s ? 'var(--accent-blue)' : 'var(--border)', color: f.side === s ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
              onClick={() => set('side', s)}>{s}</button>
          ))}
        </div>
      </Field>
      <Field label="Name"><input className="form-input" value={f.name} onChange={e => set('name', e.target.value)} /></Field>
      <Field label="AC"><NumInput value={f.ac} onChange={v => set('ac', v)} /></Field>
      <Field label="HP Max"><NumInput value={f.hp_max} onChange={v => set('hp_max', v)} /></Field>
      <Field label="Initiative Mod"><NumInput value={f.initiative_mod} onChange={v => set('initiative_mod', v)} /></Field>
      <Field label="Notes (DM only)"><textarea className="form-input" value={f.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} /></Field>
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
    if (!window.confirm('Delete this wild shape form?')) return;
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

  return (
    <div className="profile-form">
      <Field label="Form Name"><input className="form-input" value={f.form_name} onChange={e => set('form_name', e.target.value)} /></Field>
      <Field label="AC"><NumInput value={f.ac} onChange={v => set('ac', v)} /></Field>
      <Field label="HP Max"><NumInput value={f.hp_max} onChange={v => set('hp_max', v)} /></Field>
      <div className="panel-title" style={{ marginTop: 12 }}>Saving Throws</div>
      <div className="saves-grid">
        {['str','dex','con','int','wis','cha'].map(s => (
          <div key={s} className="form-group">
            <label className="form-label">{s.toUpperCase()}</label>
            <NumInput value={f[`save_${s}`]} onChange={v => set(`save_${s}`, v)} />
          </div>
        ))}
      </div>
      <Field label="Speed (optional)"><input className="form-input" value={f.speed || ''} onChange={e => set('speed', e.target.value)} /></Field>
      <Field label="Notes (optional)"><textarea className="form-input" value={f.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} /></Field>
      <div className="form-row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => onSave(f)} disabled={!f.form_name}>Save</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="form-group" style={{ marginBottom: 8 }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}