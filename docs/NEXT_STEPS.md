# DM Dashboard — Next Steps Brief

Last updated: April 10, 2026

Purpose: This file is the active implementation roadmap. It should describe what remains to be done, what is intentionally parked, and what a new chat should pick up next. It should be specific enough that a fresh chat can continue with minimal clarification after checking live GitHub first.

## Important source-of-truth order

1. Live GitHub repo
2. This Next Steps Brief
3. Project Brief for background/current-state context

If this document conflicts with the live repo, the live repo wins.

## Current Position

The app is now well past the major recovery phase and well past the original class/resource/player-card/spell-foundation stabilisation phase.

The following major areas are effectively landed and should not remain as active roadmap items here unless a real regression appears:

- recovery and repo stabilisation
- multiclass/stat/class-resource foundation
- player-card structural redesign
- DM shell / dock stabilisation
- manual temp HP / bonus max HP support
- Mage Armour runtime/profile support
- spell architecture foundation
- SRD spell import baseline
- profile spell management baseline
- runtime spell workflow baseline
- global narrowing spell filters
- Manage > Spells library/admin refactor
- homebrew spell create/edit save reliability
- initiative redesign series through PR #92
- initiative numeric edit modal
- initiative DM concentration-picker restoration

Anything listed above should only return here if it is still genuinely unfinished or broken in the live repo.

## Open Work

### 1. Initiative / Combat Presentation Completion

This is now the main active UI/gameplay cleanup area.

Status:

- initiative has already had a substantial redesign and compression pass
- DM/player/display hidden-info handling is already materially improved
- density-tier spacing tokens are now wired into initiative and player-card surfaces with display-vs-phone tuning
- player-card concentration presentation has a compact state/value treatment to avoid awkward mobile wrapping

What still needs work:

#### 1.1 Final initiative density validation and micro-polish

With density-tier wiring now landed, finish targeted validation/polish:

- phone verification with long names and many combatants
- display-table readability verification at distance
- any residual badge wrapping or top-cluster vertical waste
- any remaining edge-case concentration text balance in narrow widths

Do this as polish only; do not remove useful information or controls to create density.

### 2. Long Rest / Spell Prep Validation

Status:

- the long-rest prep flow is live
- the spell-prep rules and global filter pass landed
- the flow has been positively tested in-chat on phone/unlock behavior

What still needs work:

#### 2.1 Multi-device validation

Validate properly across real DM/player/device combinations:

- player resume/unlock behavior
- prep readiness flow
- DM completion gating
- no broken intermediate prep state if a player drops or refreshes

#### 2.2 Long-rest reset safety verification

Confirm that the prep flow still preserves the hard-won reset behavior for:

- HP
- spell slots
- concentration
- wild shape
- existing rest/resource resets

This remains rules-sensitive and should not be casually rewritten.

#### 2.3 Hit dice long-rest restoration verification

This remains a rules-tail validation item.

Target behavior:

- restore half total hit dice on long rest
- minimum 1
- never exceed max

Do not change it unless the repo inspection shows a real problem.

### 3. World Map / Display Control Work

This remains a major future-facing product item and should now be explicitly visible here.

Target direction:

- display-view world map
- controlled from DM view
- aligned with the project’s existing role separation

Current baseline now includes a DM-controlled display world-map mode with pan/zoom interactions on Display.

What still needs work:

- real-table phone/tablet verification of pinch/drag feel and map fit defaults
- optional map-source/library improvements beyond single URL flow
- any role-safe persistence refinements if DB policy changes are needed

### 4. Resource / Runtime UI Standardisation

Status:

- core runtime player resources work materially better than before
- shared policy/resource logic is in place

What still needs work:

- standardise visual language for player class resources more fully
- reduce remaining inconsistency between pips and Ready/Used presentation where appropriate

This is polish, not a blocker.

### 5. Spell / Runtime Refinement Tail

Status:

- the spell system is real and broadly functional
- Manage > Spells is now a browse/detail/admin surface rather than an assignment surface
- homebrew create/edit save is materially improved

What still needs work:

#### 5.1 broader real-table validation of spell UX under large lists

#### 5.2 custom-spell compatibility verification as more homebrew is added

#### 5.3 remaining runtime spell UX polish only if real friction appears in use

This is no longer a blank-slate feature section. It is a refinement tail.

### 6. Monster / NPC Archive Flow

Status:

- Monsters & NPCs management now supports archive / restore controls
- default active browsing excludes archived templates

What still needs work:

- confirm archive behavior across larger real-table libraries
- optional dedicated archived-count/status polish in management UI

## What Is Intentionally Parked

These are not forgotten. They are intentionally parked:

- miscellaneous shell/tab/browser-focus polish that does not materially block play
- non-critical visual cleanup outside the main initiative and spell/runtime surfaces
- broader resource visual standardisation
- later initiative micro-polish beyond the square-off and density goals
- later shell/dock aesthetic passes unless live play exposes real friction
- attempted-but-unlanded initiative/player-card follow-ups until they are actually merged

## What Is Known Attempted but Not Landed

These should remain visible so a fresh chat does not accidentally document them as already done:

- any initiative/player-card refinement attempted during connector/network failures that is not visible on current `main`

If it is not on main, it is not done.

## What A New Chat Should Do First

After reading this document and checking live GitHub:

- confirm current main and current merged PR baseline
- confirm there are no open PRs and build is healthy
- treat the initiative redesign through PR #92 as the current live starting point
- do not assume attempted follow-up initiative polish landed

Pick up the highest-value remaining work in this order:

1. verify and close remaining initiative/player-card density edge cases for display + phone while preserving readability and controls
2. continue long-rest multi-device validation / cleanup when real testing is available
3. treat world-map/display control as the next larger feature track after current combat/runtime polish

## What Should Not Be Reopened Casually

Do not casually reopen these unless the live repo shows a real problem:

- recovery plan work
- major player-card redesign
- DM dock relocation/stabilisation
- spell architecture foundation
- SRD import baseline
- Manage > Spells refactor to library/admin flow
- global spell-filter baseline
- Mage Armour foundation
- short-rest Song of Rest support
- initiative redesign series already merged through PR #92

## Success Condition for This Brief

This roadmap is in good shape if a new chat can:

- inspect live GitHub
- understand what is actually done
- understand what is still open
- see clearly which attempted items did not land
- continue from the real initiative/spell/runtime baseline
- avoid reopening already-landed work unnecessarily
