import React from 'react';
import PlayerCard from '../../components/PlayerCard';

export default function DMPlayerCardsSection({ combatants, playerStates, encounterId, playerEditMode, onUpdate }) {
  return (
    <div className="dm-section-panel">
      <div className="dm-player-card-stack">
        {combatants.length === 0 && <div className="empty-state">No players in encounter.</div>}
        {combatants.map(combatant => {
          const state = playerStates.find(playerState => playerState.combatant_id === combatant.id);
          return (
            <PlayerCard
              key={combatant.id}
              combatant={combatant}
              state={state}
              role="dm"
              isEditMode={playerEditMode}
              encounterId={encounterId}
              onUpdate={onUpdate}
            />
          );
        })}
      </div>
    </div>
  );
}
