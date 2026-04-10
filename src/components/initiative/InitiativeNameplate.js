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
  reactionPill = null,
}) {
  return (
    <div className="initiative-name-block">
      <div className="initiative-title-line">
        {miniMarker && <span className="initiative-mini-marker">{miniMarker}</span>}
        <span className="initiative-name">{name}</span>
      </div>

      <div className="initiative-meta-row initiative-meta-row--status">
        {isActive && <span className="display-order-tag display-order-tag--active">Current</span>}
        {!isActive && isNextUp && <span className="display-order-tag display-order-tag--next">On Deck</span>}
        <span className={`badge badge-${side.toLowerCase()}`}>{side}</span>
        {showBloodied && <span className="badge badge-bloodied">Bloodied</span>}
        {wsActive && <span className="initiative-inline-flag initiative-inline-flag--beast">Beast</span>}
        {reactionPill}
      </div>

      {(classLine || ancestryLine) && (
        <div className="initiative-meta-row initiative-meta-row--class">
          {classLine && <span className="initiative-detail-chip">{classLine}</span>}
          {ancestryLine && <span className="initiative-detail-chip initiative-detail-chip--muted">{ancestryLine}</span>}
        </div>
      )}
    </div>
  );
}
