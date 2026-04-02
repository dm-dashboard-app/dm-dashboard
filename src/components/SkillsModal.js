import React from 'react';
import {
  SKILL_DEFINITIONS,
  getAbilityModifiers,
  getSkillTotals,
  getSkillRank,
  getJackOfAllTradesBonus,
  getProficiencyBonus,
  getTotalLevel,
  formatModifier,
} from '../utils/classResources';

function SkillContent({ profile }) {
  const abilityMods = getAbilityModifiers(profile || {});
  const skillTotals = getSkillTotals(profile || {});
  const proficiencyBonus = getProficiencyBonus(getTotalLevel(profile || {}));
  const jackBonus = getJackOfAllTradesBonus(profile || {});

  return (
    <div className="skills-panel-body">
      <div className="skills-panel-header-row">
        <span className="skills-panel-header-cell skills-panel-header-cell--name">Skill</span>
        <span className="skills-panel-header-cell">Ability</span>
        <span className="skills-panel-header-cell">Base</span>
        <span className="skills-panel-header-cell">Rank</span>
        <span className="skills-panel-header-cell skills-panel-header-cell--total">Total</span>
      </div>

      <div className="skills-panel-list">
        {SKILL_DEFINITIONS.map(skill => {
          const rank = getSkillRank(profile || {}, skill.key);
          const rankLabel = rank === 2 ? 'Expertise' : rank === 1 ? 'Proficient' : jackBonus > 0 ? 'JOAT' : '—';
          return (
            <div key={skill.key} className="skills-panel-row">
              <div className="skills-panel-name-group">
                <span className="skills-panel-name">{skill.label}</span>
                <span className="skills-panel-ability-inline">{skill.ability.toUpperCase()}</span>
              </div>
              <span className="skills-panel-cell">{skill.ability.toUpperCase()}</span>
              <span className="skills-panel-cell">{formatModifier(abilityMods[skill.ability] ?? 0)}</span>
              <span className="skills-panel-cell skills-panel-rank">{rankLabel}</span>
              <span className="skills-panel-cell skills-panel-total">{formatModifier(skillTotals[skill.key] ?? 0)}</span>
            </div>
          );
        })}
      </div>

      <div className="skills-panel-footer">
        <span>Proficiency Bonus {formatModifier(proficiencyBonus)}</span>
        {jackBonus > 0 && <span>Jack of All Trades {formatModifier(jackBonus)}</span>}
      </div>
    </div>
  );
}

export default function SkillsModal({ open = false, onClose = null, profile, title = 'Skills', variant = 'modal' }) {
  if (!profile) return null;

  if (variant === 'panel') {
    return (
      <div className="panel skills-panel-shell">
        <div className="panel-title">{title}</div>
        <SkillContent profile={profile} />
      </div>
    );
  }

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel skills-modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="panel-title" style={{ marginBottom: 4 }}>{title}</div>
            <div className="modal-subtitle">Derived from the live profile stats, proficiencies, and expertise ranks.</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close skills">✕</button>
        </div>
        <SkillContent profile={profile} />
      </div>
    </div>
  );
}
