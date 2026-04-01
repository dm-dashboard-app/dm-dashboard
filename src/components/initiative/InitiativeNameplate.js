import React from 'react';

export default function InitiativeNameplate({
  miniMarker,
  name,
  isActive,
  isNextUp,
  side,
  showBloodied,
  wsActive,
  classLine,
  ancestryLine,
}) {
  return (
    <div className="initiative-name-block">
      <div className="initiative-title-line">
        {miniMarker && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 22,
              height: 22,
              padding: '0 6px',
              borderRadius: 999,
              background: 'rgba(74,158,255,0.12)',
              border: '1px solid var(--accent-blue)',
              color: 'var(--accent-blue)',
              fontSize: 11,
              fontWeight: 800,
              flexShrink: 0,
            }}
            title="Mini marker"
          >
            {miniMarker}
          </span>
        )}
        <span className="initiative-name">{name}</span>
        {isActive && <span className="display-order-tag display-order-tag--active">Current</span>}
        {!isActive && isNextUp && <span className="display-order-tag display-order-tag--next">On Deck</span>}
        <span className={`badge badge-${side.toLowerCase()}`}>{side}</span>
        {showBloodied && <span className="badge badge-bloodied">BLOODIED</span>}
        {wsActive && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: '#1a3a1a', color: 'var(--accent-green)' }}>
            🐻 BEAST
          </span>
        )}
      </div>

      {(classLine || ancestryLine) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minWidth: 0 }}>
          {classLine && (
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {classLine}
            </span>
          )}
          {ancestryLine && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {ancestryLine}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
