# DM Dashboard — Next Steps Brief

Last updated: April 10, 2026

Purpose: This file is the active implementation roadmap. It should describe what remains to be done, what is intentionally parked, and what a new chat should pick up next. It should be specific enough that a fresh chat can continue with minimal clarification after checking live GitHub first.

## Important source-of-truth order

1. Live GitHub repo
2. This Next Steps Brief
3. Project Brief for background/current-state context

If this document conflicts with the live repo, the live repo wins.

## Current Position

The previous initiative/combat presentation completion track, player-card/initiative resizing cleanup, long rest + spell prep validation pass, spell/runtime refinement tail, world map/display control baseline, monster/NPC archive system, build/version verification marker, and tab/focus artifact cleanup are now treated as landed baseline work.

This roadmap now tracks only genuinely remaining open work, intentionally parked items, and future ideas.

## Open Work

### 1. Real-table validation sweeps (ongoing)

Run broad real-device and live-session sweeps focused on regressions rather than redesign:

- mixed DM/player/display device handoff checks in active sessions
- long-session stability checks (refresh/rejoin/reconnect behavior)
- edge-case resource/state persistence checks under repeated rest/combat cycles

### 2. Optional world-map enhancements

The core DM-controlled display map flow is landed. Remaining items are optional product enhancements:

- map source/library quality-of-life improvements beyond a single URL flow
- optional saved presets for recurring map scenes
- additional display interaction polish only if real-table friction is observed

### 3. Optional management-surface quality-of-life

Archive and spell-management baselines are landed. Remaining items are optional polish:

- large-library filtering/search quality-of-life for Monsters & NPCs
- low-risk admin UX polish where repeated use identifies real friction

## Intentionally Parked

- broad visual/aesthetic re-theming outside live-play friction fixes
- large speculative redesigns of already-stable runtime flows
- non-critical shell polish that does not improve in-session play reliability

## Future Ideas (not committed roadmap)

- richer campaign/session memory tooling if it can stay mobile-first and low-friction
- optional deeper display-scene orchestration beyond current map mode

## What A New Chat Should Do First

After reading this document and checking live GitHub:

1. confirm current `main`, open PR state, and build/deploy health
2. verify any reported issue against the current landed baseline before proposing changes
3. prioritise regression fixes and proven friction over speculative redesign

## Success Condition for This Brief

This roadmap is in good shape if a new chat can:

- quickly see that prior large upgrade tracks are already landed
- identify only true remaining open work
- avoid reopening completed initiative/player-card/rest/spell/world-map/archive tracks without a verified regression
