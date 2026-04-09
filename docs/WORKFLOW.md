# DM Dashboard — Working Workflow and Safety Protocol

Last updated: April 8, 2026

Document purpose: This file defines how the DM Dashboard project must be worked on.

Scope boundary: Process, safety, verification, document maintenance, and handoff only. Do not use this file as the feature roadmap or as the current-state app brief.

## Purpose

This document defines how the DM Dashboard project is worked on. It is not a feature brief and it is not a product-scope document. It exists to preserve a stable, repeatable development workflow across future chats and implementation batches.

This document should be used alongside:

- the live GitHub repository
- the current Next Steps Brief
- the current Project Brief

These three support files are important project memory anchors. Their contents must be carried forward carefully at handoff and during document rewrites.

## Source of Truth Order

Always use this priority order:

1. Live GitHub repo
2. Current Next Steps Brief
3. Current Project Brief

If any document conflicts with the live repo, the live repo wins.

## Startup Sequence for New Chats

Before proposing implementation or rewriting project docs, do this in order:

1. read the current Workflow document
2. read the current Next Steps Brief
3. read the current Project Brief
4. inspect the live GitHub repo as master source of truth
5. confirm what is merged on main
6. confirm open PR state and deployment/build health
7. only then continue

This startup sequence is mandatory for both implementation work and documentation-reconciliation work.

## Working Definition of the Current Upgrade Phase

For this project, the phrase current planned upgrade scope means the active upgrade path after the class/resource and spell-system foundation landed and after the major recovery work was stabilised. It now mainly covers:

- remaining spell/runtime refinement
- rest-flow validation and remaining rules-tail cleanup
- initiative/combat presentation refinement
- world/display map work
- deferred polish that materially helps live play

This workflow document may refer to that as the current planned upgrade scope. It should not be used as the roadmap itself.

## Core Working Rules

### 1.1 Repo-first rule

Before proposing implementation details, always inspect the live repo state first.

That means checking:

- current files
- current merged baseline
- what actually landed on main
- whether production is on the expected version
- whether an open PR is based on current main or on an older stale base

### 1.2 Direct-edit workflow

This project now uses a direct GitHub editing workflow by default.

That means:

- inspect the live repo first
- edit GitHub directly by default when implementation is requested
- do not output full file replacements unless they are explicitly requested
- still think in terms of full-file integrity even when editing directly

#### 1.2.1 Direct GitHub connector editing method for existing files

When editing existing files through the GitHub connector/tools inside ChatGPT, do not rely on create_file as the default path for overwriting existing files.

For existing files, the preferred method is the low-level Git object flow:

- fetch the current branch head commit
- fetch the current contents of every file to be changed from that exact branch
- create a new blob for each full replacement file
- create a new tree from the branch head’s tree SHA
- create a commit using:
  - the new tree SHA
  - the branch head commit SHA as parent
- update the branch ref to that new commit
- fetch the edited files back from that exact branch and verify contents before PR open

This is the safest default for multi-file edits because:

- it works more reliably for existing files
- it keeps a contained batch atomic in one commit
- it avoids partial overwrite failures
- it matches Git’s real object model more clearly than file-by-file overwrite attempts

Connector editing rule for existing files:

For existing files:

- prefer create_blob + create_tree + create_commit + update_ref
- avoid create_file unless the connector explicitly supports safe overwrite for that exact case

Tree / commit SHA safety rule:

Do not confuse commit SHA and tree SHA.

- create_tree requires a tree SHA as its base
- create_commit requires:
  - parent commit SHA
  - new tree SHA

Never use a commit SHA where a tree SHA is required.

Base-tree safety rule:

Always build from the current head tree of the branch being edited.

Do not build from:

- a different branch unless explicitly intended
- a guessed baseline

Using the wrong base tree can accidentally reintroduce stale snapshots or drop newer files.

Branch update safety rule:

Use update_ref with force: false for normal forward progress.

Only use force: true when:

- deliberately rewriting your own branch tip
- recovery or explicit ref repair is intended
- the new commit/tree has been verified

Multi-file batch rule:

For a contained multi-file batch, prefer:

- one blob per changed file
- one combined create_tree call containing all changed files
- one commit
- one branch ref update

Avoid chains of many tiny tree rewrites unless there is a clear reason.

Post-write verification rule:

After updating a branch through the GitHub connector, before opening or signing off a PR:

- fetch every changed file from that exact branch
- verify the content is what was intended
- verify local imports in changed files
- verify referenced local files exist on that same branch
- then proceed to PR creation and the normal PR checklist

This connector-specific method is mandatory for existing-file edits when working directly in GitHub through ChatGPT.

#### 1.2.2 Large-file / connector-fragility rule

Some large existing-file overwrites through the connector can fail even when:

- branch creation works
- fetches work
- searches work
- PR/status checks work

If a large write path fails repeatedly, treat that as connector fragility, not as proof that the repo or branch is wrong.

Operational response:

- reduce scope to the smallest contained batch
- prefer one-file PRs when a monolith file is involved
- prefer low-level blob/tree/commit flow over overwrite flow
- do not keep retrying the same giant payload blindly
- if a write path fails twice, stop looping and switch to a smaller or safer route

#### 1.2.3 Persisted-versus-attempted work rule

Prepared content, created blobs, or partial tree work are not the same as landed repo work.

Only treat work as real repo state if at least one of these is true:

- the branch ref was moved to a verified new commit
- the changed file can be fetched back from that exact branch
- a PR was created from the branch and verified

Do not document attempted-but-unpersisted work as complete.

### 1.3 Browser-first and mobile-first reality

This project is still worked on in a browser-first, mobile-aware workflow.

That means:

- no assumed local development environment
- no dependency on desktop IDE workflow
- no casual fallback to “run this locally”
- instructions must remain realistic for browser and mobile GitHub use
- GitHub and Vercel guidance must be practical for iPhone use when needed

### 1.4 Full-file integrity rule

Even though direct GitHub edits are now the default, changes must still preserve:

- complete file integrity
- no speculative half-edits
- no missing dependency files
- no assumption that another branch already contains required files
- no signing off incomplete branch state

This replaces the old blanket “full file replacements only” rule as the actual operational standard for normal GitHub editing.

### 1.5 One-line patch naming

Every implementation batch should include a short copyable patch name:

- concise
- action-oriented
- easy to identify in PR history

## Branch and PR Management Rules

### 2.1 Main is not an experiment branch

main must be treated as protected in practice.

That means:

- never use main for speculative experiments
- never use main for recovery guesswork
- never “just try” a fix directly on main
- never casually move main to a different commit unless it is a verified recovery step

### 2.2 New work starts from a verified-good baseline

Before creating a new branch, verify:

- what commit main points to
- whether main is healthy
- whether production is healthy
- whether the new work should branch from main or from another explicitly verified-good branch in a recovery case

#### 2.2.1 Main-tip confirmation rule

Before any new work begins, confirm that current main matches the last merged PR expected by the current chat/session.

If main has moved:

- stop
- identify what merged
- rebase mentally onto the new live baseline before doing more work

This protects against delayed merge visibility and stale-base follow-up branches.

#### 2.2.2 Re-check-main-between-batches rule

After each merge and before each new implementation batch:

- re-check current main
- re-check open PR state
- re-check build/deploy health if relevant

Do not assume main is unchanged just because no one is intentionally editing it.


### 2.2.3 Live-main recheck immediately before branch creation

Right before creating any new implementation branch, re-check current live `main`.

Do not rely on:
- earlier startup output
- stale PR metadata
- task memory of what `main` used to be

If `main` has moved, branch from the new live tip.

### 2.2.4 Live-main recheck immediately before PR creation

Right before opening a PR, re-check current live `main` again.

If the implementation branch was created from an older `main` tip and the compare now shows the branch is behind current `main`, do not hand-wave that PR as acceptable.

Instead:
- recreate the branch from the new live `main` tip
- replay the validated changes
- open the PR from that clean base

### 2.3 One clean branch per batch

Use one branch per contained batch of work.

Avoid:

- stacking speculative fixes
- mixing unrelated work in the same branch
- branching from stale feature branches unless that is deliberate and verified


### 2.3 Fresh coding batch rule

A new coding batch on the same issue does not require a new chat.

Same chat is acceptable.

However, a new coding batch should default to:
- a fresh branch from current live `main`
- no automatic attachment to an older PR
- no reuse of a closed PR
- no reuse of a deleted branch
- no assumption that an older Codex review branch remains canonical

### 2.3.1 Canonical PR rule

For one coding batch, there must be at most one active canonical PR.

That means:
- do not open overlapping replacement PRs for the same batch
- do not create two live PRs touching the same intended batch unless the user explicitly requests that
- if a PR is being replaced, close the superseded PR first
- report clearly which PR is canonical and which PR should be ignored or closed

### 2.3.2 Fresh-PR-by-default rule

If the user wants to continue coding but does not explicitly say “update the current PR,” do not assume the old PR should be reused.

Instead:
- treat the request as a fresh batch
- start from current live `main`
- create a fresh branch
- wait to open a PR until the batch is actually ready

### 2.3.3 Closed-PR non-reuse rule

A closed PR is not canonical work state.

Do not:
- keep attaching new work to a closed PR
- treat a deleted PR branch as still active
- continue speaking as though a closed PR remains the review target

If the prior PR was closed, start fresh from live `main`.

### 2.4 Close bad rescue branches quickly

If a rescue or experimental branch is known to be broken, stale, or unsafe:

- do not merge it
- close the PR
- delete the branch once no longer needed

### 2.5 Keep one obvious recovery branch when needed

If recovery is underway, keep one clearly named backup branch from the last known-good state.

Do not keep multiple competing rescue paths alive once the real anchor is known.

## Implementation Workflow

### 3.1 Before coding

Before implementation, establish:

- what the user wants changed
- what the live repo already contains
- whether the work is new work, cleanup, or recovery
- whether SQL is required
- whether there is already an open deployment or PR blocker
- whether the planned change depends on files not yet present on the target branch


### 3.1.1 Execution-preflight report

Before changing code, explicitly report:

- MODE: GitHub-connected live repo path vs any local/worktree path
- LIVE REPO: full repository name
- BASE BRANCH
- HEAD BRANCH
- OPEN PRS FOR THIS EXACT BATCH
- WHETHER THE TASK WILL UPDATE AN EXISTING PR OR START A FRESH BRANCH

If the task is not on a real GitHub-connected path that can create or update the live repository branch/PR, stop before changing code.

Do not present non-live commits as merge-ready.

### 3.2 Clarification-before-action rule

If important intent is unclear, destructive interpretation is possible, or the requested behavior could reasonably mean more than one thing, ask focused questions before changing code.

Use this especially when:

- a requested simplification might remove valuable existing behavior
- UI changes could imply hiding or deleting information
- a rules workflow has multiple plausible interpretations
- the user’s wording could lead to destructive loss of hard-won functionality

Do not ask unnecessary questions when the user’s intent is already clear and the safest path is obvious.

### 3.3 During implementation

Prefer:

- contained batches
- practical, testable progress
- minimal repo risk
- feature grouping that makes sense in PR review

Avoid:

- tiny meaningless fragment batches
- bloated mixed-purpose branches
- changing unrelated systems during a focused fix

### 3.4 After implementation

For each batch, identify:

- whether SQL is required
- what the user should test
- what intentionally remains out of scope
- whether Vercel should be expected to rebuild
- whether the PR is actually safe to review and merge

### 3.4.1 Mandatory completion-log update on every PR

Every implementation PR must update project-memory docs as part of the same batch so done vs not-done state stays reliable across sessions.

This is a hard merge-readiness gate, not optional housekeeping.

Minimum required behavior for every PR:

1. classify each scoped item as:
   - landed now
   - still open
   - attempted but not landed
2. update `docs/NEXT_STEPS.md` to keep only real open work
3. move durable landed items into `docs/PROJECT_BRIEF.md`
4. keep `docs/WORKFLOW.md` process-only (do not put roadmap items here)
5. include a short PR section named **Completion Log Update** summarizing:
   - what moved from open -> landed
   - what remains open
   - what is explicitly not verified as landed

If a PR has no product-impacting changes, include a one-line Completion Log Update saying no roadmap-state changes were required.

If no support-doc content changes are needed, the PR must still include an explicit no-change Completion Log Update note. Omitting the section is not allowed.

Any implementation PR that does not include the required Completion Log Update and any necessary support-doc changes is not merge-ready and must not be handed off as ready.

### 3.5 SQL handling

If SQL is required:

- provide it separately from file/code changes
- say clearly whether it is additive, corrective, or cleanup SQL
- do not mix schema assumptions with guesses

## Verification Discipline

### 4.1 Branch Integrity Rule

Before handing over any PR, verify on the PR branch itself that:

- every newly imported local file exists on that exact branch
- every edited file’s local imports resolve to files present on that exact branch
- the branch contains the files the feature actually depends on
- the branch is not missing files that existed only on a different unmerged branch

Never assume dependency files carried over from earlier work unless explicitly confirmed.

### 4.2 Dependency Presence Sweep

For any UI or component batch, perform a dependency presence sweep before signoff:

- check new imports
- check renamed files
- check newly referenced components
- check that reused components actually exist on the target branch

A PR is not ready just because the intended code was written. It is ready only when the branch contents match the intended dependency graph.

### 4.3 PR Conflict Check Rule

Before a PR is handed over as ready for review, testing, or merge, it must be checked on the assistant side for:

- no reported merge conflicts against current main
- no stale branch-base conflict risk
- no unresolved branch divergence causing GitHub conflict banners
- no incomplete-branch issues caused by stale history

A PR is not considered signed off if GitHub still shows conflict risk or unresolved mergeability issues.


### 4.3.1 Pre-handoff mergeability report

Before handing over any PR, report all of the following explicitly:

- PR number
- base branch
- head branch
- whether GitHub reports it as mergeable / unable to merge / still calculating
- whether the branch compare is ahead and behind by the expected amount

If this cannot be verified, the PR is not ready for handoff.

### 4.4 PR Readiness Rule

A PR may only be signed off when all of the following are true:

- the intended files are present
- local imports resolve
- branch integrity is verified
- no merge conflicts are reported or expected
- Vercel/build status is understood
- the user has a clear test scope

### 4.5 Code-path verification rule

For live bugs or rules-sensitive behavior, do not stop at surface symptoms.

Trace the real owning code path.

That means verifying:

- where the state originates
- where it is transformed
- where it is persisted
- where it is presented
- whether the bug is local, shared-policy, or schema-related

Do not “fix” a rules-sensitive bug by inference if the owning path is visible in the repo.

## Recovery and Git Safety Rules

### 5.1 Recovery mindset

If the repo or app appears damaged, first establish:

- what actually broke
- whether the issue is repo state, branch state, production state, or app logic
- what the last known-good repo snapshot is
- whether the app is actually gone, or whether main is pointing at a bad tree
- whether there is already a viable restore branch

### 5.2 Git safety principle

Git commits are full snapshots, not “only the files meant to be touched.”

That means a bad branch ref or bad commit can make the app appear deleted while history still contains it.

Therefore:

- never treat branch movement casually
- never assume a commit only affects intended files
- always verify the actual tree

### 5.3 Main branch safety rule

Never force-move main unless:

- recovery is explicitly required
- the target commit is verified
- the action is clearly understood as recovery
- there is no safer practical alternative

### 5.4 Last-known-good anchor rule

If the repo appears damaged:

- identify the last known-good commit or merged PR
- create one recovery branch from that point if needed
- verify the full repo tree exists there
- use that as the restoration anchor

### 5.5 Production isolation rule

If Vercel never deployed the broken state:

- do not rush to change Vercel
- stabilize GitHub first
- keep production unchanged until the repo is safe

## Communication Rules

### 6.1 Be explicit about certainty

If something is verified, say it is verified.

If something is inferred, say it is inferred.

If something is uncertain, say so clearly.

### 6.2 No false “done”

Do not present a fix or recovery as complete unless:

- repo state is verified
- branch state is verified
- deployment state is understood
- the user can act safely on the result

### 6.3 No bluffing around build issues

If the actual log is needed, say so.

Do not repeatedly guess from partial symptoms.

### 6.4 Keep instructions operational

When the user is working from mobile or under pressure:

- give exact steps
- keep them actionable
- explain Git concepts plainly when needed


### 6.5 Command-result truthfulness rule

Do not claim that a command, build, lint run, or test run happened unless it actually happened in the current task environment.

If a command was not run, say it was not run.

If a command could not be run, say that clearly.

Do not substitute intention, memory, or expected output for real command execution.

### 6.6 Instruction refresh rule

If `AGENTS.md` or the workflow docs are changed during a task/run, do not assume the current run has adopted those new instructions.

Start a fresh task/run before relying on new repo instruction behavior.

## DM Dashboard-Specific Working Principles

### 7.1 Preserve role separation

Always preserve distinct behavior for:

- DM
- player
- display

### 7.2 Preserve RLS-sensitive behavior

Never casually break or bypass:

- monster HP visibility rules
- role-based data boundaries
- server-side protections

### 7.3 Prefer RPCs for complex operations

Where behavior is stateful, rules-sensitive, or security-sensitive, prefer Supabase RPC-backed handling over fragile client-only logic.

### 7.4 Session-first mindset

Treat the app as a persistent session dashboard, not just a one-encounter builder.

That means prioritizing:

- live-session stability
- low-friction DM use
- quick in-session actions
- minimal disruption during play

## Preferred Working Sequence for Future Chats

When resuming in a new chat:

- inspect the live repo first
- inspect the current uploaded source documents
- identify current main
- identify open PR and deployment blockers
- confirm production state
- continue from the correct branch baseline
- ask focused clarifying questions first if intent is materially unclear
- implement in contained batches
- verify branch integrity
- verify PR conflict state
- verify actual code paths for rules-sensitive bugs
- provide patch name and SQL separately where needed
- only then sign off a PR

## Handoff Procedure

When preparing a handoff for a new chat:

- update the Workflow document first
- update the Next Steps Brief second
- update the Project Brief third
- only after those are rewritten, produce the copy-paste handoff block

The handoff block must instruct the next chat to:

- read all three current support documents
- inspect the live GitHub repo before proposing or changing anything substantial
- verify what is already merged on main
- verify any open PRs and deployment state
- continue from the real live baseline, not from memory alone

## Document-maintenance rule

When rewriting support files:

- preserve important project knowledge already captured in them
- remove stale roadmap items from Next Steps when they are clearly done
- move durable completed work into the Project Brief
- keep Workflow process-only
- keep Next Steps roadmap-only
- keep Project Brief as current-state/background context only

## PR-template automation rule for completion logging

To keep this process repeatable across sessions, the repository must maintain a PR template that includes a required **Completion Log Update** section.

That section must force the author to state:

- landed this PR
- still open after this PR
- not verified / not landed
- which support docs were updated

If the template is missing or stale, update it in the same batch before signoff.

Do not mark an implementation PR ready until that required section is present and completed.

## Documentation-reconciliation rule

When a documentation reconciliation/update pass is requested:

- do the startup sequence first
- classify work into three buckets:
  - verified landed
  - still open / parked
  - not verified / do not document as landed
- use merged main and current repo files as the final decision maker
- do not let attempted-but-unmerged branch work leak into the support docs

## Hard Safety Rules

These are non-negotiable:

- Do not use main as an experiment surface
- Do not stack rescue fixes on broken tree states
- Do not assume production equals current GitHub state
- Do not change Vercel in a panic
- Do not force-move main except as explicit verified recovery
- Do not present an unverified repair as complete
- Do not merge failing recovery PRs
- Do not sign off PRs with unresolved conflicts
- Do not sign off PRs with unresolved missing-file dependency risk
- Do not assume files from earlier branches exist on a new branch
- Do not forget to verify mergeability before handoff
- Do not skip code-path verification on live bugs

## Immediate Lessons Incorporated

### 11.1 Catastrophic repo incident lesson

A bad branch snapshot can make the app appear deleted even when history still contains it.

Vercel failure can protect production by refusing to deploy broken code.

Recovery must start from a verified-good anchor, not guesswork.

### 11.2 Dependency and PR lesson

A branch can compile-fail simply because a referenced file never landed on that branch.

A PR can be logically correct but still unsafe to merge if it is stale against current main.

PRs must be conflict-checked before they are handed off.

Branch-integrity checks are mandatory, not optional.

### 11.3 Direct GitHub editing lesson

Direct GitHub editing reduces copy-paste friction, but it increases the need for:

- branch-integrity discipline
- PR verification discipline
- code-path verification discipline
- stricter signoff standards

### 11.4 Replacement PR rule

If a PR is contaminated with unintended files:

- do not hand-wave it
- create a clean replacement branch/PR from current main
- tell the user explicitly which PR to ignore or close and which one to use

### 11.5 Failed lookup/tool loop rule

If a lookup or tool path fails twice:

- stop looping
- say the lookup path is unreliable
- switch to a different concrete route or the next verifiable task

### 11.6 Recovery/fix-phase rule

When working on recovery or fix phases:

- prefer isolated, single-file or tightly-scoped fixes where possible
- prefer root shared-policy fixes over scattered local hacks when the bug is clearly in shared rules
- if hidden DB/RPC logic cannot be inspected from the repo, state that clearly and patch only the visible side safely
- but if the bug is visible in the code path, trace and fix the real owning path instead of guessing

### 11.7 Monolith handling rule

If a file is large and central to active work:

- proactively thin it carefully
- extract low-risk or pure subcomponents first
- keep parent behavior stable while shrinking it
- verify direct consumers before PR handoff

### 11.8 GitHub connector base-validation rule

When using the GitHub connector low-level write flow, treat commit-search results as advisory only, not as final proof of the current main baseline.

Before creating a branch or PR, verify the intended base commit directly and confirm that the branch compare against that base shows the expected relationship.

Connector base-validation checklist:

- confirm the intended main/base SHA
- after branch write, compare intended base vs branch head and verify ahead_by matches the contained batch and behind_by is 0
- after PR open, verify the PR base SHA matches the intended main SHA
- do not treat green build status alone as proof that the PR base is correct

Stale-base recovery rule:

If a branch or PR was built from the wrong base, but the code change itself is correct:

- do not merge it
- do not try to hand-wave the stale-base mismatch away
- create a clean replacement branch from the verified current main tip
- replay the exact validated file blobs/tree/commit onto that clean base
- open a replacement PR and explicitly mark the stale PR as ignore/close

### 11.9 Attempted-versus-landed lesson

In this project, there were multiple cases where a file was rebuilt or a write was attempted several times but never actually landed because the connector/network path failed.

Therefore:

- never treat “I rebuilt the file” as proof of repo state
- never document work as landed unless it is visible on main or on a verified PR branch
- if a branch only exists but no write/commit is confirmed, treat it as empty for practical purposes


### 11.10 PR-state anchoring lesson

A coding agent can become anchored to an older PR or review branch even when the user intends a fresh coding batch.

Therefore:
- same chat is allowed
- new batch does not mean new chat
- but new batch should default to a fresh branch from current live `main`
- old PR reuse must be explicit, not assumed

### 11.11 Closed-PR reuse lesson

Closed PRs and deleted branches must not be treated as still-active review targets.

If a PR is closed:
- stop referring to it as canonical
- stop attaching new work to it
- start fresh from live `main`

### 11.12 Main-movement lesson

In this project, `main` can change during a task.

Therefore:
- one startup check is not enough
- `main` must be re-checked immediately before branch creation
- `main` must be re-checked immediately before PR creation
- stale-base PRs must be rebuilt, not rationalized away

## Success Condition

This workflow is successful if:

- future chats can resume without chaos
- repo state is verified before risky actions
- PRs are conflict-free before handoff
- branch integrity is verified before handoff
- deployment issues are handled from evidence, not guesswork
- live bugs are fixed through verified code paths, not inference
- documentation passes reflect real merged state rather than attempted work
- the project can continue moving through the current planned upgrade scope without repeating the recovery incidents
