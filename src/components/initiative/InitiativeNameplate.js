import React from 'react';

export default function InitiativeNameplate({ miniMarker, name }) {
  return (
    <div className="initiative-name-block">
      <div className="initiative-title-line">
        {miniMarker ? <span className="initiative-mini-marker">{miniMarker}</span> : null}
        <span className="initiative-name">{name}</span>
      </div>
    </div>
  );
}
