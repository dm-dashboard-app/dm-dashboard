import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';

function NpcEditor({ npc, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: npc?.name || '',
    race: npc?.race || '',
    portrait_url: npc?.portrait_url || '',
    body_text: npc?.body_text || '',
  });

  return (
    <div className="world-sheet-backdrop" onClick={onCancel}>
      <div className="world-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="world-sheet-head">
          <strong>{npc?.id ? 'Edit NPC' : 'New NPC'}</strong>
          <button className="btn btn-ghost" onClick={onCancel}>Close</button>
        </div>
        <div className="world-form-grid">
          <input className="form-input" placeholder="Name" value={form.name} onChange={(event) => setForm((v) => ({ ...v, name: event.target.value }))} />
          <input className="form-input" placeholder="Race / species" value={form.race} onChange={(event) => setForm((v) => ({ ...v, race: event.target.value }))} />
          <input className="form-input" placeholder="Portrait URL" value={form.portrait_url} onChange={(event) => setForm((v) => ({ ...v, portrait_url: event.target.value }))} />
          <textarea className="form-input" rows={10} placeholder="NPC info and notes" value={form.body_text} onChange={(event) => setForm((v) => ({ ...v, body_text: event.target.value }))} />
          <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.name.trim()}>Save NPC</button>
        </div>
      </div>
    </div>
  );
}

export default function WorldNpcsPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [npcs, setNpcs] = useState([]);
  const [selectedNpcId, setSelectedNpcId] = useState(null);
  const [editingNpc, setEditingNpc] = useState(null);

  const loadNpcs = useCallback(async (preferredNpcId = null) => {
    const { data, error: loadError } = await supabase.rpc('dm_world_get_npcs');
    if (loadError) throw loadError;
    const rows = data || [];
    setNpcs(rows);
    if (preferredNpcId) {
      setSelectedNpcId(preferredNpcId);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        await loadNpcs();
      } catch (loadError) {
        if (active) setError(loadError.message || 'Failed to load NPCs.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [loadNpcs]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return npcs;
    return npcs.filter((npc) => `${npc.name || ''} ${npc.race || ''} ${npc.body_text || ''}`.toLowerCase().includes(needle));
  }, [npcs, query]);

  const selectedNpc = useMemo(() => npcs.find((npc) => npc.id === selectedNpcId) || null, [npcs, selectedNpcId]);

  async function saveNpc(form) {
    try {
      const { data, error: saveError } = await supabase.rpc('dm_world_upsert_npc', {
        p_npc_id: editingNpc?.id || null,
        p_name: form.name,
        p_race: form.race,
        p_portrait_url: form.portrait_url,
        p_body_text: form.body_text,
      });
      if (saveError) throw saveError;
      setEditingNpc(null);
      setStatus('NPC saved.');
      await loadNpcs(data);
    } catch (saveError) {
      setError(saveError.message || 'Failed to save NPC.');
    }
  }

  if (loading) return <div className="empty-state">Loading NPC library…</div>;

  return (
    <div className="world-shops-shell">
      {status ? <div className="world-shops-import-status">{status}</div> : null}
      {error ? <div className="world-shops-error">{error}</div> : null}

      {!selectedNpc ? (
        <>
          <div className="world-mobile-stack">
            <input className="form-input" placeholder="Search NPCs" value={query} onChange={(event) => setQuery(event.target.value)} />
            <button className="btn btn-primary" onClick={() => setEditingNpc({})}>New NPC</button>
          </div>
          <div className="world-card-grid">
            {filtered.map((npc) => (
              <button key={npc.id} type="button" className="world-card world-card-button" onClick={() => setSelectedNpcId(npc.id)}>
                <div className="world-card-head"><strong>{npc.name}</strong><span>{npc.race || 'Unknown race'}</span></div>
                <div className="world-card-body">{(npc.body_text || 'No profile text saved.').slice(0, 160)}</div>
              </button>
            ))}
            {filtered.length === 0 ? <div className="empty-state">No NPCs match this search.</div> : null}
          </div>
        </>
      ) : (
        <div className="world-npc-page">
          <button className="btn btn-ghost" onClick={() => setSelectedNpcId(null)}>← Back to NPC list</button>
          <div className="world-npc-hero">
            {selectedNpc.portrait_url ? <img className="world-npc-portrait" src={selectedNpc.portrait_url} alt={`${selectedNpc.name} portrait`} /> : <div className="world-npc-portrait world-npc-portrait-empty">No Portrait</div>}
            <div className="world-card">
              <div className="world-card-head"><strong>{selectedNpc.name}</strong><span>{selectedNpc.race || 'Race not set'}</span></div>
              <div className="world-card-body" style={{ whiteSpace: 'pre-wrap', minHeight: 180 }}>{selectedNpc.body_text || 'No NPC details saved yet.'}</div>
            </div>
          </div>
          <button className="btn btn-primary world-fab" onClick={() => setEditingNpc(selectedNpc)}>Edit NPC</button>
        </div>
      )}

      {editingNpc ? <NpcEditor npc={editingNpc.id ? editingNpc : null} onSave={saveNpc} onCancel={() => setEditingNpc(null)} /> : null}
    </div>
  );
}
