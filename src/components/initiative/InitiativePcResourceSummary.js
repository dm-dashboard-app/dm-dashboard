import React from 'react';
import { supabase } from '../../supabaseClient';
import { readNumberField } from '../../utils/classResources';
import {
  RESOURCE_SURFACES,
  getSurfaceResourceConfig,
  resolveResourceToggleState,
} from '../../utils/resourcePolicy';
import { compactObject } from './initiativeUtils';

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

function PcResourceChip({ resource, state, isDM, onUpdateFields }) {
  const isWarlockSlots = resource.id === 'warlock-slots';
  const accentColor = isWarlockSlots ? 'var(--accent-gold)' : 'var(--accent-blue)';
  const accentFill = isWarlockSlots ? 'rgba(240,180,41,0.22)' : 'var(--accent-blue)';

  if (resource.type === 'toggle') {
    const toggleState = resolveResourceToggleState(resource, state);

    async function toggle() {
      if (!isDM) return;
      const nextReady = !toggleState.ready;
      const nextRaw = resource.toggleMode === 'available' ? nextReady : !nextReady;
      await onUpdateFields({ [resource.boolKey]: nextRaw });
    }

    return (
      <button
        type="button"
        onClick={toggle}
        disabled={!isDM}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 7px',
          borderRadius: 999,
          border: `1px solid ${toggleState.ready ? 'var(--accent-green)' : 'var(--accent-red)'}`,
          background: toggleState.ready ? 'rgba(62,207,106,0.08)' : 'rgba(224,48,80,0.08)',
          color: toggleState.ready ? 'var(--accent-green)' : 'var(--accent-red)',
          fontSize: 10,
          fontWeight: 700,
          cursor: isDM ? 'pointer' : 'default',
          opacity: isDM ? 1 : 0.95,
        }}
        title={resource.meta || undefined}
      >
        <span>{resource.label}</span>
        <span>{toggleState.label}</span>
        {resource.meta ? <span style={{ color: 'var(--text-muted)' }}>• {resource.meta}</span> : null}
      </button>
    );
  }

  const { current, max } = resolveDisplayedValues(resource, state);

  if (resource.type === 'counter') {
    async function adjust(delta) {
      if (!isDM) return;
      const upper = max ?? Math.max(current, 0);
      const next = Math.max(0, Math.min(upper, current + delta));
      if (next === current) return;
      await onUpdateFields({ [resource.currentKey]: next, ...(resource.maxKey && max !== null ? { [resource.maxKey]: max } : {}) });
    }

    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 7px',
          borderRadius: 999,
          border: '1px solid var(--border)',
          background: 'var(--bg-panel-3)',
          color: isWarlockSlots ? accentColor : 'var(--text-primary)',
          fontSize: 10,
          fontWeight: 700,
        }}
        title={resource.meta || undefined}
      >
        <span>{resource.label}</span>
        {isDM && (
          <button onClick={() => adjust(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>
            −
          </button>
        )}
        <span>{current}{max !== null ? `/${max}` : ''}</span>
        {resource.meta ? <span style={{ color: isWarlockSlots ? accentColor : 'var(--text-muted)' }}>{resource.meta}</span> : null}
        {isDM && (
          <button onClick={() => adjust(1)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>
            +
          </button>
        )}
      </div>
    );
  }

  const safeMax = Math.max(0, max ?? current ?? 0);
  const safeCurrent = Math.max(0, Math.min(safeMax, current ?? 0));

  async function setPips(nextCurrent) {
    if (!isDM) return;
    const clamped = Math.max(0, Math.min(safeMax, nextCurrent));
    const updates = { [resource.currentKey]: clamped };
    if (resource.maxKey && max !== null) updates[resource.maxKey] = max;
    await onUpdateFields(updates);
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 7px',
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: 'var(--bg-panel-3)',
        color: 'var(--text-primary)',
        fontSize: 10,
        fontWeight: 700,
      }}
      title={resource.meta || undefined}
    >
      <span>{resource.label}</span>
      <span style={{ display: 'inline-flex', gap: 3 }}>
        {Array.from({ length: safeMax }).map((_, i) => {
          const active = i < safeCurrent;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setPips(active ? i : i + 1)}
              disabled={!isDM}
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                padding: 0,
                border: `1.5px solid ${active ? accentColor : 'var(--border-strong)'}`,
                background: active ? accentFill : 'transparent',
                cursor: isDM ? 'pointer' : 'default',
              }}
            />
          );
        })}
      </span>
      {resource.meta ? <span style={{ color: isWarlockSlots ? accentColor : 'var(--text-muted)' }}>{resource.meta}</span> : null}
    </div>
  );
}

export default function InitiativePcResourceSummary({ profile, state, isDM, onUpdate }) {
  const resources = getSurfaceResourceConfig(profile || {}, state || {}, RESOURCE_SURFACES.INITIATIVE);
  if (!resources.length) return null;

  async function updateResourceFields(updates) {
    const payload = compactObject(updates);
    if (!state?.id || !Object.keys(payload).length) return;
    await supabase.from('player_encounter_state').update(payload).eq('id', state.id);
    onUpdate();
  }

  return (
    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {resources.map(resource => (
        <PcResourceChip
          key={resource.id}
          resource={resource}
          state={state}
          isDM={isDM}
          onUpdateFields={updateResourceFields}
        />
      ))}
    </div>
  );
}
