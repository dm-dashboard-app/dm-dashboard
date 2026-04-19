import React from 'react';
import WorldShopsPanel from './WorldShopsPanel';
import WorldRewardsPanel from './WorldRewardsPanel';
import WorldLocalesPanel from './WorldLocalesPanel';
import WorldNpcsPanel from './WorldNpcsPanel';

export default function WorldPanel({ encounterId, playerStates, refreshAll = null, onInventoryRefresh = null, tab = 'locales' }) {
  return (
    <div className="world-shops-shell">
      {tab === 'locales' ? <WorldLocalesPanel playerStates={playerStates} role="dm" /> : null}
      {tab === 'shops' ? <WorldShopsPanel showImportControls={false} encounterId={encounterId} playerStates={playerStates} /> : null}
      {tab === 'rewards' ? <WorldRewardsPanel encounterId={encounterId} playerStates={playerStates} onInventoryChanged={refreshAll} onInventoryRefresh={onInventoryRefresh} /> : null}
      {tab === 'npcs' ? <WorldNpcsPanel role="dm" /> : null}
    </div>
  );
}
