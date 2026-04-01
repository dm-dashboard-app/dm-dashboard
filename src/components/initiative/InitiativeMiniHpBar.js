import React from 'react';

export default function InitiativeMiniHpBar({ current, max, tempHp = 0, color, label }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const tempPct = max > 0 ? Math.max(0, Math.min(100, (tempHp / max) * 100)) : 0;
  const barColor = color || (pct > 50 ? 'var(--hp-high)' : pct > 25 ? 'var(--hp-mid)' : 'var(--hp-low)');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {label && (
        <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
      )}
      <div style={{ position: 'relative', height: 6, background: 'var(--bg-panel-3)', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${pct}%`,
            background: barColor,
            borderRadius: 3,
            transition: 'width 0.3s',
          }}
        />
        {tempHp > 0 && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              height: '100%',
              width: `${Math.min(tempPct, 100 - pct)}%`,
              background: 'var(--hp-temp)',
              opacity: 0.7,
              borderRadius: 3,
            }}
          />
        )}
      </div>
    </div>
  );
}
