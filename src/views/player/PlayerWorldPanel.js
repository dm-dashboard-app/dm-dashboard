import React from 'react';
import WorldLocalesPanel from '../dm/WorldLocalesPanel';
import WorldNpcsPanel from '../dm/WorldNpcsPanel';

export default function PlayerWorldPanel({ tab = 'locales' }) {
  return (
    <div className="world-shops-shell">
      {tab === 'locales' ? <WorldLocalesPanel role="player" /> : null}
      {tab === 'npcs' ? <WorldNpcsPanel role="player" /> : null}
    </div>
  );
}
