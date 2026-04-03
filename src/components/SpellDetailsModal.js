import React from 'react';

export default function SpellDetailsModal({ spell, onClose }) {
  if (!spell) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={{ width: 'min(760px, calc(100vw - 24px))', maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="panel-title" style={{ marginBottom: 4 }}>{spell.name}</div>
            <div className="modal-subtitle">
              {Number(spell.level) === 0 ? 'Cantrip' : `Level ${spell.level}`} • {spell.school || 'Unknown school'}
              {spell.concentration ? ' • Concentration' : ''}
              {spell.ritual ? ' • Ritual' : ''}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
          <div><strong>Casting Time:</strong> {spell.castingTime || '—'}</div>
          <div><strong>Range:</strong> {spell.rangeText || '—'}</div>
          <div><strong>Duration:</strong> {spell.durationText || '—'}</div>
          <div><strong>Components:</strong> {spell.componentsText || '—'}{spell.materialText ? ` (${spell.materialText})` : ''}</div>
          <div><strong>Classes:</strong> {(spell.classTags || []).join(', ') || '—'}</div>
        </div>

        <div style={{ marginTop: 12, whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text-primary)' }}>
          {spell.description || 'No description available yet.'}
        </div>

        {spell.higherLevel && (
          <div style={{ marginTop: 12, whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text-secondary)' }}>
            <strong>At Higher Levels:</strong> {spell.higherLevel}
          </div>
        )}
      </div>
    </div>
  );
}
