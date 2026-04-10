# DM Dashboard — Project Brief

Last updated: April 10, 2026

Purpose: This document is the current-state/background brief for DM Dashboard. It describes what the app now is, what is materially landed, and what principles future work must preserve.

This is not the roadmap. For open work and planning tracks, use `docs/NEXT_STEPS.md`.

## Source-of-truth order

1. Live GitHub repo
2. Next Steps Brief
3. This Project Brief

If this brief conflicts with the live repo, the live repo wins.

## Project Overview

DM Dashboard is a mobile-first, session-oriented tabletop companion with distinct DM, player, and display surfaces.

Core product character:

- built for real live play (not just prep)
- fast session operation under phone constraints
- clear role boundaries between DM, player, and display
- safe handling of hidden/sensitive combat information

## Durable Product Baseline (landed)

### 1) Session-first architecture and role separation

Landed baseline:

- separate DM / player / display experiences
- session/encounter runtime state layered over durable profile setup
- hidden-info behavior preserved outside DM view where required

Preservation rule:

- keep DM authority, player usability, and display-safe output clearly separated

### 2) Player profile + derived character foundation

Landed baseline includes:

- multiclass-aware profiles
- derived stats/modifiers/saves/skills support
- hit dice and initiative derivation support
- spell DC / spell attack derivation support
- profile-first resource and capability modeling

Preservation rule:

- durable character identity/capability belongs in profile state; temporary encounter effects belong in runtime overlay

### 3) Player card and combat presentation baseline

Landed baseline includes:

- stabilized compact player-card and initiative presentation
- clear AC / PP / spell DC / spell attack visibility
- improved HP readability with DM temp HP and bonus max HP handling
- concentration/reaction presentation tuned for fast scan
- initiative numeric edit and concentration picker DM workflows
- hidden enemy AC/HP protections outside DM contexts
- tab/focus artifact cleanup and runtime build marker verification behavior

Preservation rule:

- maintain dense-but-readable combat cards without regressing hidden-info safeguards

### 4) DM mobile shell baseline

Landed baseline includes:

- mobile-oriented DM shell and bottom-dock interaction model
- practical tab grouping and fast in-session action reach
- stabilized alert/notification handling for live play

Preservation rule:

- prioritize one-handed mobile practicality over desktop-first UI assumptions

### 5) Spell + rest operational baseline

Landed baseline includes:

- spell library and spell-management foundation
- runtime spell access/preparation/concentration workflows
- known/prepared runtime viewing model
- long-rest preparation procedure integrated into long-rest flow
- short-rest extension support (including Song of Rest path)

Preservation rule:

- treat rest/spell behavior as rules-sensitive and shared-logic driven; avoid fragmented per-surface rewrites

### 6) Display world-map baseline

Landed baseline includes:

- DM-controlled display map mode from Manage → Session → Display Screen
- saved map URL state with DM toggle control
- forced display map-only rendering while enabled
- map pan/zoom interactions inside display mode

Preservation rule:

- DM owns display control state; display renders but does not self-govern mode

### 7) Monster/NPC archive baseline

Landed baseline includes:

- archive/unarchive flow for monster/NPC templates
- default active lists remain cleaner for session use
- non-destructive recovery path for archived templates

Preservation rule:

- keep archive operations reversible and admin-friendly

## Architectural / Product Principles for Future Work

- mobile-first practicality for real table use
- session stability over clever but fragile rewrites
- shared rules/modifier logic over duplicated component-local hacks
- profile-first durable setup with encounter-state runtime overlay
- preserve DM/player/display role boundaries and RLS-sensitive behavior

## Future-facing note

Inventory/equipment/abilities is currently a **planning track**, not landed baseline behavior. If pursued later, it should be phased and aligned with shared modifier-logic architecture (as outlined in `docs/NEXT_STEPS.md`).
