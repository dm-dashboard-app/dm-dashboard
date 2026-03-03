import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function EncounterSetup({ onEncounterCreated }) {
  const [name, setName] = useState('');
  const [players, setPlayers] = useState([]);
  const [monsters, setMonsters] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [monsterQueue, setMonsterQueue] = useState([]); // [{template, qty}]
  const [saving, setSaving] = useState(false);
  const [joinCodes, setJoinCodes] = useState({});

  useEffect(() => {
    supabase.from('profiles_players').select('*').then(({ data }) => setPlayers(data || []));
    supabase.from('profiles_monsters').select('*').then(({ data }) => setMonsters(data || []));
  }, []);

  function togglePlayer(id) {
    setSelectedPlayers(s =>
      s.includes(id) ? s.filter(p => p !== id) : [...s, id]
    );
  }

  function addMonsterToQueue(template) {
    setMonsterQueue(q => {
      const existing = q.find(m => m.template.id === template.id);
      if (existing) return q.map(m => m.template.id === template.id ? { ...m, qty: m.qty + 1 } : m);
      return [...q, { template, qty: 1 }];
    });
  }

  function removeMonsterFromQueue(id) {
    setMonsterQueue(q => q.filter(m => m.template.id !== id));
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      // Create encounter
      const { data: enc } = await supabase
        .from('encounters')
        .insert({ name: name.trim() })
        .select()
        .single();

      const codes = {};

      // Add PC combatants + generate join codes
      for (const pid of selectedPlayers) {
        const profile = players.find(p => p.id === pid);
        if (!profile) continue;

        const { data: combatant } = await supabase
          .from('combatants')
          .insert({
            encounter_id: enc.id,
            name: profile.name,
            side: 'PC',
            owner_player_id: pid,
            ac: profile.ac,
            hp_max: profile.max_hp,
            hp_current: profile.max_hp,
          })
          .select()
          .single();

        // Init player encounter state
        await supabase.from('player_encounter_state').insert({
          combatant_id: combatant.id,
          encounter_id: enc.id,
          player_profile_id: pid,
          current_hp: profile.max_hp,
        });

        // Generate join code
        const { data: code } = await supabase.rpc('generate_join_code', {
          p_encounter_id: enc.id,
          p_player_profile_id: pid,
        });
        codes[profile.name] = code;
      }

      // Add monster combatants
      const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (const { template, qty } of monsterQueue) {
        for (let i = 0; i < qty; i++) {
          await supabase.from('combatants').insert({
            encounter_id: enc.id,
            name: qty > 1 ? `${template.name} ${LABELS[i]}` : template.name,
            side: 'ENEMY',
            ac: template.ac,
            hp_max: template.hp_max,
            hp_current: template.hp_max,
            initiative_mod: template.initiative_mod,
            notes: template.notes,
          });
        }
      }

      setJoinCodes(codes);
      onEncounterCreated(enc);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-title">New Encounter</div>

      <div className="form-group">
        <label className="form-label">Encounter Name</label>
        <input
          className="form-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Goblin Ambush"
        />
      </div>

      <div className="divider" />

      <div className="form-group">
        <label className="form-label">Players</label>
        {players.length === 0 && <div className="empty-state">No player profiles yet. Create them in Manage.</div>}
        {players.map(p => (
          <label key={p.id} className="checkbox-row">
            <input
              type="checkbox"
              checked={selectedPlayers.includes(p.id)}
              onChange={() => togglePlayer(p.id)}
            />
            <span>{p.name}</span>
          </label>
        ))}
      </div>

      <div className="divider" />

      <div className="form-group">
        <label className="form-label">Monsters</label>
        {monsters.length === 0 && <div className="empty-state">No monster templates yet. Create them in Manage.</div>}
        <div className="monster-template-list">
          {monsters.map(m => (
            <div key={m.id} className="monster-template-row">
              <span>{m.name} (AC {m.ac}, HP {m.hp_max})</span>
              <button className="btn btn-ghost btn-icon" onClick={() => addMonsterToQueue(m)}>+</button>
            </div>
          ))}
        </div>
        {monsterQueue.length > 0 && (
          <div className="monster-queue">
            {monsterQueue.map(({ template, qty }) => (
              <div key={template.id} className="monster-queue-row">
                <span>{template.name} ×{qty}</span>
                <button className="btn btn-danger btn-icon" onClick={() => removeMonsterFromQueue(template.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="divider" />

      <button
        className="btn btn-primary btn-lg"
        onClick={handleCreate}
        disabled={saving || !name.trim()}
      >
        {saving ? 'Creating…' : 'Create Encounter'}
      </button>

      {Object.keys(joinCodes).length > 0 && (
        <div className="join-codes-panel">
          <div className="panel-title">Join Codes — Send to Players</div>
          {Object.entries(joinCodes).map(([playerName, code]) => (
            <div key={playerName} className="join-code-row">
              <span className="join-code-name">{playerName}</span>
              <span className="join-code-value">{code}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}