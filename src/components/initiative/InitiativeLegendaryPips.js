import React from 'react';

export default function InitiativeLegendaryPips({ label, max, used, isDM, onSpend, onRestore, onReset, isActive }) {
  if (max === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 9, color: 'var(--accent-gold)', fontWeight: 700, width: 16, textTransform: 'uppercase' }}>
        {label}
      </span>
      {Array.from({ length: max }).map((_, i) => {
        const isSpent = i < used;
        return (
          <button
            key={i}
            onClick={e => {
              e.stopPropagation();
              if (!isDM) return;
              isSpent ? onRestore() : onSpend();
            }}
            title={isDM ? (isSpent ? 'Restore' : 'Spend') : undefined}
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              border: '2px solid var(--accent-gold)',
              background: isSpent ? 'transparent' : 'var(--accent-gold)',
              cursor: isDM ? 'pointer' : 'default',
              padding: 0,
              transition: 'background 0.1s',
            }}
          />
        );
      })}
      <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 2 }}>
        {used > 0 ? `${max - used}/${max}` : `${max}/${max}`}
      </span>
      {isDM && isActive && (
        <button
          onClick={e => {
            e.stopPropagation();
            onReset();
          }}
          title="Reset (start of turn)"
          style={{
            fontSize: 11,
            color: 'var(--accent-gold)',
            opacity: used === 0 ? 0.2 : 0.7,
            padding: '0 2px',
            cursor: used === 0 ? 'default' : 'pointer',
            background: 'none',
            border: 'none',
            transition: 'opacity 0.15s',
          }}
          disabled={used === 0}
        >
          ↺
        </button>
      )}
    </div>
  );
}
