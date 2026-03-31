import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { readNumberField, findExistingKey } from '../utils/classResources';
import { getShortRestResourcePatch } from '../utils/resourcePolicy';

function getStateHitDicePools(state = {}, profile = {}) {
  const pools = [
    { size: 6, currentKey: 'hit_dice_d6_current', maxKey: 'hit_dice_d6_max', current: readNumberField(state, ['hit_dice_d6_current'], 0), max: readNumberField(state, ['hit_dice_d6_max'], 0) },
    { size: 8, currentKey: 'hit_dice_d8_current', maxKey: 'hit_dice_d8_max', current: readNumberField(state, ['hit_dice_d8_current'], 0), max: readNumberField(state, ['hit_dice_d8_max'], 0) },
    { size: 10, currentKey: 'hit_dice_d10_current', maxKey: 'hit_dice_d10_max', current: readNumberField(state, ['hit_dice_d10_current'], 0), max: readNumberField(state, ['hit_dice_d10_max'], 0) },
    { size: 12, currentKey: 'hit_dice_d12_current', maxKey: 'hit_dice_d12_max', current: readNumberField(state, ['hit_dice_d12_current'], 0), max: readNumberField(state, ['hit_dice_d12_max'], 0) },
  ].filter(pool => pool.max > 0 || pool.current > 0);

  if (pools.length > 0) return pools;

  const legacyCurrent = readNumberField(state, ['hit_dice_current', 'hit_dice_remaining'], null);
  const legacyMax = readNumberField(state, ['hit_dice_max'], null);
  const legacySize = readNumberField(state, ['hit_die_size'], readNumberField(profile, ['hit_die_size'], null));

  if (legacyCurrent !== null || legacyMax !== null || legacySize !== null) {
    return [{
      size: legacySize || 0,
      currentKey: findExistingKey(state, ['hit_dice_current', 'hit_dice_remaining']) || 'hit_dice_current',
      maxKey: findExistingKey(state, ['hit_dice_max']) || 'hit_dice_max',
      current: legacyCurrent ?? 0,
      max: legacyMax ?? 0,
    }];
  }

  return [];
}

function formatHitDicePoolSummary(pools = []) {
  return pools.map(pool => `${pool.current}${pool.max !== null ? `/${pool.max}` : ''} d${pool.size}`).join(' • ');
}

function buildShortRestPatch(state = {}, healAmount = 0, spentBySize = {}) {
  const patch = {};
  const hpCurrent = readNumberField(state, ['current_hp'], 0);
  const maxHp = (() => {
    const override = readNumberField(state, ['max_hp_override'], null);
    if (override !== null) return override;
    const profileMax = readNumberField(state?.profiles_players, ['max_hp'], null);
    if (profileMax !== null) return profileMax;
    return readNumberField(state, ['current_hp'], 0);
  })();

  const safeHeal = Math.max(0, parseInt(healAmount, 10) || 0);
  patch.current_hp = Math.min(maxHp, hpCurrent + safeHeal);

  const pools = getStateHitDicePools(state, state?.profiles_players || {});
  if (pools.length > 0) {
    pools.forEach(pool => {
      const requested = Math.max(0, parseInt(spentBySize[`d${pool.size}`], 10) || 0);
      const spend = Math.max(0, Math.min(pool.current, requested));
      patch[pool.currentKey] = pool.current - spend;
    });
  } else {
    const hitDiceCurrentKey = findExistingKey(state, ['hit_dice_current', 'hit_dice_remaining']);
    if (hitDiceCurrentKey) {
      const currentDice = readNumberField(state, [hitDiceCurrentKey], 0);
      const totalSpend = Object.values(spentBySize || {}).reduce((sum, value) => sum + (parseInt(value, 10) || 0), 0);
      const spend = Math.max(0, Math.min(currentDice, totalSpend));
      patch[hitDiceCurrentKey] = currentDice - spend;
    }
  }

  return patch;
}

function mergeDefined(...objects) {
  const merged = {};
  objects.forEach(obj => {
    Object.entries(obj || {}).forEach(([key, value]) => {
      if (value !== undefined) merged[key] = value;
    });
  });
  return merged;
}

export default function ShortRestModal({ open, playerStates, encounterId, onClose, onComplete }) {
  const [drafts, setDrafts] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const rows = useMemo(() => {
    return (playerStates || []).map(state => {
      const profile = state?.profiles_players || {};
      const name = profile.name || 'Unknown Player';
      const currentHp = readNumberField(state, ['current_hp'], 0);
      const maxHpOverride = readNumberField(state, ['max_hp_override'], null);
      const profileMax = readNumberField(profile, ['max_hp'], 0);
      const maxHp = maxHpOverride !== null ? maxHpOverride : profileMax;
      const hitDicePools = getStateHitDicePools(state, profile);
      return { state, profile, name, currentHp, maxHp, hitDicePools };
    });
  }, [playerStates]);

  useEffect(() => {
    if (!open) return;
    const next = {};
    rows.forEach(row => {
      const hitDice = {};
      row.hitDicePools.forEach(pool => {
        hitDice[`d${pool.size}`] = '';
      });
      next[row.state.id] = { heal: '', hitDice };
    });
    setDrafts(next);
  }, [open, rows]);

  function updateDraft(stateId, field, value) {
    setDrafts(current => ({
      ...current,
      [stateId]: { ...(current[stateId] || { heal: '', hitDice: {} }), [field]: value },
    }));
  }

  function updateHitDiceDraft(stateId, dieLabel, value) {
    setDrafts(current => ({
      ...current,
      [stateId]: {
        ...(current[stateId] || { heal: '', hitDice: {} }),
        hitDice: { ...((current[stateId] || {}).hitDice || {}), [dieLabel]: value },
      },
    }));
  }

  async function handleApplyShortRest() {
    if (!encounterId || submitting) return;
    setSubmitting(true);
    try {
      for (const row of rows) {
        const state = row.state;
        const profile = row.profile;
        const draft = drafts[state.id] || { heal: '', hitDice: {} };
        const healAmount = Math.max(0, parseInt(draft.heal, 10) || 0);
        const spentBySize = draft.hitDice || {};
        const basePatch = buildShortRestPatch(state, healAmount, spentBySize);
        const resourcePatch = getShortRestResourcePatch(state, profile);
        const patch = mergeDefined(basePatch, resourcePatch);

        if (Object.keys(patch).length > 0) {
          await supabase.from('player_encounter_state').update(patch).eq('id', state.id);
        }

        const spentSummary = Object.entries(spentBySize)
          .map(([label, value]) => ({ label, value: Math.max(0, parseInt(value, 10) || 0) }))
          .filter(entry => entry.value > 0)
          .map(entry => `${entry.value}${entry.label}`)
          .join(' ');

        if (healAmount > 0 || spentSummary) {
          const fromHp = readNumberField(state, ['current_hp'], 0);
          const toHp = patch.current_hp ?? fromHp;
          await supabase.from('combat_log').insert({
            encounter_id: encounterId,
            actor: 'DM',
            action: 'heal',
            detail: `${row.name}: short rest${healAmount > 0 ? ` +${healAmount} HP (${fromHp} → ${toHp})` : ''}${spentSummary ? `${healAmount > 0 ? ' •' : ''} ${spentSummary} spent` : ''}`,
          });
        }
      }

      await supabase.from('encounters').update({ round: 1, turn_index: 0 }).eq('id', encounterId);
      await supabase.from('combat_log').insert({
        encounter_id: encounterId,
        actor: 'DM',
        action: 'rest',
        detail: 'Short Rest completed — short-rest resources restored and round reset to 1',
      });

      onComplete?.();
      onClose?.();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="rest-modal-overlay" onClick={onClose}>
      <div className="rest-modal-panel" onClick={e => e.stopPropagation()}>
        <div className="rest-modal">
          <div className="rest-modal-header">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="panel-title" style={{ margin: 0 }}>Short Rest</div>
              <div className="rest-modal-subtitle">
                Enter each player's total healing rolled and spent hit dice by die size.
              </div>
            </div>
            <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Close</button>
          </div>

          <div className="rest-modal-body">
            {rows.length === 0 && <div className="empty-state">No player states found for this encounter.</div>}
            {rows.map(row => {
              const draft = drafts[row.state.id] || { heal: '', hitDice: {} };
              const healPreview = Math.max(0, parseInt(draft.heal, 10) || 0);
              const previewHp = Math.min(row.maxHp, row.currentHp + healPreview);
              return (
                <div key={row.state.id} className="rest-modal-player-card">
                  <div className="rest-modal-player-header">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span className="rest-modal-player-name">{row.name}</span>
                      <span className="rest-modal-player-meta">
                        HP {row.currentHp} / {row.maxHp}
                        {healPreview > 0 ? ` → ${previewHp} / ${row.maxHp}` : ''}
                      </span>
                    </div>
                    {row.hitDicePools.length > 0 && <span className="rest-modal-hit-dice">{formatHitDicePoolSummary(row.hitDicePools)}</span>}
                  </div>

                  <div className="rest-modal-grid">
                    <label className="rest-modal-field">
                      <span className="rest-modal-label">Healing Applied</span>
                      <input className="rest-modal-input" type="number" inputMode="numeric" min={0} value={draft.heal} onChange={e => updateDraft(row.state.id, 'heal', e.target.value)} placeholder="0" />
                    </label>
                  </div>

                  {row.hitDicePools.length > 0 && (
                    <div className="rest-modal-grid" style={{ marginTop: 8 }}>
                      {row.hitDicePools.map(pool => (
                        <label key={`${row.state.id}-d${pool.size}`} className="rest-modal-field">
                          <span className="rest-modal-label">Spend d{pool.size}</span>
                          <input className="rest-modal-input" type="number" inputMode="numeric" min={0} max={pool.current} value={draft.hitDice?.[`d${pool.size}`] || ''} onChange={e => updateHitDiceDraft(row.state.id, `d${pool.size}`, e.target.value)} placeholder="0" />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rest-modal-actions">
            <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
            <button className="btn btn-primary" onClick={handleApplyShortRest} disabled={submitting}>{submitting ? 'Applying…' : 'Apply Short Rest'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
