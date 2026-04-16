import React, { useState } from 'react';
import WorldLocalesPanel from '../dm/WorldLocalesPanel';
import WorldNpcsPanel from '../dm/WorldNpcsPanel';

export default function PlayerWorldPanel() {
  const [tab, setTab] = useState('locales');

  return (
    <div className="world-shops-shell">
      <div className="world-tabs-row" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost" data-active={tab === 'locales'} onClick={() => setTab('locales')}>Locales</button>
        <button className="btn btn-ghost" data-active={tab === 'npcs'} onClick={() => setTab('npcs')}>NPCs</button>
      </div>
      {tab === 'locales' ? <WorldLocalesPanel role="player" /> : null}
      {tab === 'npcs' ? <WorldNpcsPanel role="player" /> : null}
    </div>
  );
}
