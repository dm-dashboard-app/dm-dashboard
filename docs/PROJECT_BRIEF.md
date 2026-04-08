# DM Dashboard — Project Brief

Last updated: April 8, 2026

Purpose: This document is the reference/background brief for the DM Dashboard project. It should describe what the app now is, how it is structured, what has materially landed, and the major design principles that future work should preserve.

This is not the live roadmap. Use the Next Steps Brief for active remaining work. Use the live GitHub repo as final source of truth when checking implementation details.

## Source-of-truth order

1. Live GitHub repo
2. Next Steps Brief
3. This Project Brief

If this brief conflicts with the live repo, the live repo wins.

## Project Overview

DM Dashboard is a mobile-first, session-oriented encounter dashboard for tabletop play with distinct DM, player, and display experiences.

The app is designed to support live play, not just encounter setup. Stability, fast session use, low-friction player interaction, and safe DM control are core priorities.

Primary roles:

- DM
- player
- display

These roles must remain distinct in behavior, visibility, and sensitive data handling.

## Core Product Goals

The app is intended to provide:

- fast encounter/session management for the DM
- clear, readable player-facing information
- safe display-mode presentation for table/shared screens
- live combat tracking
- player resource and spell awareness
- rest workflows
- low-friction mobile use in real sessions

## Architecture / System Character

The current app is now shaped by several major stabilisation waves and should be understood as having these major pillars:

- Encounter/session-first architecture
- Distinct DM / player / display surfaces
- Player profiles as durable setup anchors
- Runtime encounter state layered on top of profile data
- Shared policy-driven handling for class resources and derived character values
- Spell system foundation with runtime spell workflow
- Rest workflows layered into live encounter state

## Current Baseline — What Is Materially Landed

The following are now part of the project’s current durable baseline.

### Repo and Product Recovery Baseline

A major recovery phase was completed after earlier repository/branch incidents.

Important durable lessons now reflected in the project culture:

- repo safety and branch discipline matter materially
- Vercel can protect production by refusing broken deploys
- recovery must come from a verified-good anchor
- branch and dependency verification are now part of the project’s practical process culture

This is historical context, not an active product roadmap item.

### Multiclass / Profile / Derived Character Foundation

The player profile system now supports a much stronger class-driven baseline than earlier versions.

Materially landed:

- multiclass-aware player profiles
- derived character values driven from profile/class context
- stat and modifier handling
- saving throw totals
- skill support
- hit dice derivation
- spell DC / spell attack derivation
- initiative derivation support
- profile-first class/resource logic

The important product principle here is:

- profile data defines durable character setup
- encounter state carries temporary/live-session state
- shared logic should derive values from profile state rather than re-implementing them ad hoc across multiple views

### Player Card Redesign and Stabilisation

The player card system went through a major redesign and is now a core polished surface of the app.

Materially landed:

- portrait retained as a core identity element
- stronger reaction and concentration presentation
- clearer AC / PP / spell DC / spell attack presentation
- thicker and more readable HP presentation
- DM support for temp HP and bonus max HP
- improved attribute score and saving throw layout
- skills access from player-facing surfaces
- reduced overflow/truncation issues
- much stronger visual hierarchy for important player information

Important design principles preserved here:

- portrait matters and should remain
- AC, concentration, passive perception, spell DC, and spell attack must remain easy to find
- layout and hierarchy should solve density problems rather than removing useful information
- mobile readability matters more than theoretical compactness

Current live limitation:

player cards still show a generic concentration state label rather than the actual linked spell name. That refinement has not landed yet and should not be treated as current baseline behavior.

### DM Mobile Shell / Bottom Dock / Alert Structure

The DM shell was materially reworked to improve one-handed mobile play.

Materially landed:

- bottom action row / dock orientation
- tab order and control grouping adapted for easier mobile use
- recent alerts and DM-side notification handling improved
- shell structure stabilised after several iterations

Current intent:

- DM view is mobile-use-first
- common combat actions should be easy to reach one-handed
- alerts should support fast, practical in-session acknowledgment

### Initiative and Combat Presentation Baseline

Initiative presentation went through a significant redesign sequence and is now materially different from the older baseline.

Materially landed:

- initiative/player/NPC/enemy card redesign
- enemy AC and enemy HP hidden outside DM view where appropriate
- reaction and concentration promoted into full-width bars
- player resource summary kept on a single horizontal line in initiative
- DM-only advanced non-player controls tucked behind a More toggle
- initiative numeric edit modal for DM entry
- initiative concentration picker path restored for DM use
- better hidden-info preservation outside DM view

Important principle:

- initiative must remain dense but readable
- the first read must be fast
- the card should prioritise initiative, identity, reaction, concentration, and HP without destroying hidden-info rules

Current live limitation:

the exact “squared-off” top-band layout is not yet landed. The current live initiative layout is improved and compressed, but not yet at the final intended alignment target.

### Player Resource and HP Adjustment Systems

A stronger runtime player-state layer now exists around HP and class resources.

Materially landed:

- manual temp HP support
- manual bonus max HP support
- max HP reset flow
- bonus max HP also heals by the granted amount
- DM-facing HP adjustment controls integrated into player-card flow
- class/resource display foundation across player surfaces

Important principle:

- DM runtime adjustments belong on the player-card live surface
- resource logic should remain shared and policy-driven wherever possible

### Mage Armour Support

Mage Armour support is now part of the live baseline.

Materially landed:

- profile capability flag
- runtime toggle behavior
- AC integration
- initiative/player-state visibility support

Important principle:

- profile enables capability
- encounter state carries active runtime status
- derived values respond to runtime state

### Spell System Foundation

The spell system is no longer just a concept; it is a real project pillar.

Materially landed:

- spell architecture foundation
- SRD spell library import baseline
- player-profile spell management baseline
- runtime spell workflow baseline
- spell detail inspection surface
- DM/player spell viewing surfaces
- concentration picker foundation
- preparation-aware runtime model support

The spell system is now based on a profile-first approach plus runtime workflow layers.

## Current Spell Model Intent

The spell model now broadly follows this structure:

Prepared casters:

- legal spell access by class and level
- prepared subset as a distinct runtime/preparation concern

Known casters:

- spells are assigned at profile level
- runtime Known view reflects assigned/learned access

Wizard:

- hybrid model
- learned spellbook plus prepared subset

Cantrips:

- manual assignment

Runtime spell surface:

- Prepared / Known views
- filterable lists
- spell detail modal
- concentration selection tied to a dedicated picker flow rather than a cast/spend workflow

Important product principle:

the app’s runtime spell workflow is now centered on access, preparation, inspection, and concentration-linking, not on hard in-app slot-casting automation.

### Spell Management / Library Baseline

Manage > Spells is no longer a mixed assignment/admin surface.

Materially landed:

- library/admin-only spell management surface
- detail-first spell browsing
- homebrew create/edit save with explicit create-versus-update handling
- assignment UI removed from the management screen
- homebrew editing retained through detail/modal flow
- global narrowing spell filters shared with the wider spell workflow
- Known view as the default actionable runtime prep surface
- Prepared view as the prepared-only review surface

This is now part of the live product character and should not be treated as a speculative design.

### Long Rest Preparation Procedure Baseline

A long-rest spell-preparation procedure now exists in the live system.

Materially landed:

- long rest can enter a preparation phase for the relevant classes
- player readiness / DM completion structure exists
- this is layered around the existing long-rest reset behavior rather than replacing it

Important note:

this system is currently live, but broader multi-device validation and cleanup still remain as roadmap work.

### Rest Workflow Extensions

Short rest work has also materially advanced.

Materially landed:

- Song of Rest support in short-rest flow
- ongoing integration between resource/reset systems and class logic

Important principle:

rest behavior is rules-sensitive and must be preserved carefully. Existing stable rest/reset behavior should not be casually rewritten.

## Design Principles That Must Be Preserved

### Mobile-first practicality

The app is meant to be usable in real live play on phones. Tap size, quick scanning, bottom-reach actions, and simple interaction flow matter.

### Session stability over cleverness

Do not trade reliability for elegant but fragile architecture changes.

### Shared logic over scattered local hacks

Where a rule is shared, prefer a shared policy/derivation layer rather than duplicated component-local logic.

### Profile-first durable setup

Character identity, class structure, and durable spell/resource capability should come from profile data.

### Encounter-state runtime overlay

Live HP, concentration, preparation readiness, temporary toggles, and similar active session state belong in encounter/runtime state.

### Readability before decoration

Dense UI is acceptable; unreadable UI is not.

### Role separation

DM, player, and display experiences must remain distinct.

### Sensitive-information preservation

Do not casually break hidden-information behavior, especially around monster/NPC visibility.

## Current Project Character Summary

At this point, DM Dashboard is best understood as:

- a live session dashboard
- with durable player profiles
- runtime encounter overlays
- strong player-card UX
- class/resource-aware character logic
- a real spell workflow foundation
- mobile-oriented DM control surfaces
- explicit role separation
- increasing rules-sensitive workflow support

## What This Brief Is For

Use this brief to understand:

- what the project now is
- what systems are already real
- what major architectural and UX principles have already been established
- what future work should preserve

Do not use this brief as the active task list. Use the Next Steps Brief for that.

## What Future Chats Should Assume

A future chat should assume:

- major recovery work is historical, not active roadmap work
- the player-card redesign is part of baseline reality
- the spell system is real and not a blank-slate design task
- the runtime spell workflow exists and should be refined carefully rather than rebuilt casually
- Manage > Spells is already a library/admin and detail-oriented surface
- the long-rest preparation procedure exists, even if further validation still remains
- profile-first and encounter-state layering are core to the current implementation direction
- the initiative redesign through PR #92 is real baseline work, but some finishing polish is still open

## Success Condition for This Brief

This brief is working if a new chat can read it and quickly understand:

- what kind of product DM Dashboard now is
- what has materially landed
- what system principles are already established
- what remains a live limitation versus true baseline behavior
- what should not be casually redesigned or reopened
- how to interpret the live repo and Next Steps in context
