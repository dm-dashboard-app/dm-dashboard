# DM Dashboard Repo Instructions

This repository uses a repo-native instruction system for future Codex/GitHub work.

## Source-of-truth order

Always use this priority order:

1. Live GitHub repo
2. `docs/NEXT_STEPS.md`
3. `docs/PROJECT_BRIEF.md`

If any document conflicts with the live repo, the live repo wins.

## Mandatory startup sequence

Before proposing implementation, changing code, opening or reviewing PRs, or rewriting docs, always do this in order:

1. Read `docs/WORKFLOW.md`
2. Read `docs/NEXT_STEPS.md`
3. Read `docs/PROJECT_BRIEF.md`
4. Inspect the live GitHub repo as master source of truth
5. Confirm what is merged on `main`
6. Confirm open PR state and deployment/build health
7. Only then continue

This startup sequence is mandatory for both implementation work and documentation-reconciliation work.

## What each file is for

- `docs/WORKFLOW.md` is the authoritative long-form process, safety, verification, and handoff document.
- `docs/NEXT_STEPS.md` is the active roadmap and open-work list.
- `docs/PROJECT_BRIEF.md` is the current-state/background brief.

Do not blur these roles:
- Workflow = process/safety only
- Next Steps = roadmap only
- Project Brief = current-state/background only

## Repo-first rule

Before proposing implementation details, always inspect the live repo state first.

That includes checking:
- current files
- current merged baseline
- what actually landed on `main`
- whether production/build is on the expected version
- whether any open PR is based on current `main` or a stale base

## Execution preflight rule

Before any implementation batch, report the following first:
- MODE: GitHub-connected live repo path vs any local/worktree path
- LIVE REPO: full repository name
- BASE BRANCH
- HEAD BRANCH
- OPEN PRS FOR THIS EXACT BATCH
- WHETHER THE TASK WILL UPDATE AN EXISTING PR OR START A FRESH BRANCH

If the task is not operating on a real GitHub-connected path that can create or update the live repository branch/PR, stop before changing code and say so clearly.

Do not present local-only, worktree-only, or otherwise non-live commits as merge-ready.

### Repo hydration evidence rule (important)

For this repository, shell `git remote -v` output alone is **not** sufficient proof of non-live mode.

Environment bootstrap may:

- add `origin`
- fetch live GitHub state
- create the working branch from `FETCH_HEAD`
- then remove `origin`

If setup/bootstrap logs show:

- remote add
- successful fetch
- branch creation from `FETCH_HEAD`

then treat that as valid live-repo hydration evidence unless contradicted by stronger evidence.

## Documentation update merge-readiness gate

Implementation PRs are merge-ready only when required support-doc updates are included in the same PR (`docs/NEXT_STEPS.md`, `docs/PROJECT_BRIEF.md`, and `docs/WORKFLOW.md` when process changed).

PR-body completion-log prose is optional. Repo docs remain the durable project record.

Do not sign off or present a PR as ready if required support-doc updates are missing.

## Fresh coding batch default

For a new coding batch on the same issue, same chat is fine.

Default behavior is:
- start from current live `main`
- create a fresh branch for the new batch
- do not attach to an older open PR unless the user explicitly says to continue that PR
- do not reuse any closed PR
- do not reuse any deleted branch
- do not assume a prior Codex review branch is canonical

## PR lifecycle rules

- One active PR maximum for one coding batch.
- Do not create overlapping replacement PRs for the same batch.
- If the user wants a fresh PR instead of updating an old one, create a fresh branch from current live `main`.
- If a PR is superseded, close it before opening the replacement PR.
- Before handoff, report the exact canonical PR number and whether the branch is mergeable.

## Main-movement rule

`main` can move while a task is running.

Therefore:
- re-check `main` immediately before branch creation
- re-check `main` immediately before PR creation
- if `main` moved in between, recreate the branch from the new live `main` tip instead of hand-waving a stale-base PR

## Hard working rules

- Edit GitHub directly when implementation is requested.
- Preserve full-file integrity even when editing directly.
- Do not use `main` as an experiment surface.
- Use one clean branch per contained batch.
- Verify branch integrity and PR mergeability before signoff.
- Do not document attempted-but-unlanded work as complete.
- For live bugs or rules-sensitive behavior, trace the real owning code path rather than fixing by surface inference.
- Provide SQL separately when SQL is required.

### SQL rollout surfacing rule (hard operational gate)

If a batch introduces or changes any required database-side object or behavior, including:

- SQL migration
- table
- column
- policy
- grant
- function
- RPC
- trigger
- view
- any server-side database object

then the operator-facing handoff/review response must include all of the following:

1. an explicit statement that SQL rollout is required
2. the exact SQL file path(s)
3. and, when the operator is working through browser/Supabase instead of local dev, either:
   - the direct SQL block, or
   - a clearly labeled direct Supabase apply step

Operational clarifications:

- “SQL exists in the repo” is not enough.
- DB-dependent batches are not operationally complete until this SQL requirement is surfaced plainly to the operator.
- This repo is browser/mobile/iPhone oriented; do not leave the operator hunting for required SQL after merge.

### SQL delivery contract in final Codex completion response (hard merge gate)

If a batch requires SQL, the final Codex completion response **must** include all of the following:

1. `SQL REQUIRED: yes`
2. exact SQL file path(s)
3. a clearly labeled section named `SQL TO APPLY`
4. the **full SQL text pasted directly** in that response under `SQL TO APPLY`
5. the exact Supabase apply step

Non-acceptable behavior (forbidden):

- only saying SQL exists in the repo
- only giving file paths
- telling the operator to retrieve SQL from the repository

If SQL is too large for one block, it must be split into clearly labeled consecutive parts in the **same final response**.

A SQL-bearing batch is not complete unless the SQL text itself is directly included in the final response.

Review enforcement rule:

- Any PR that requires SQL is automatically **NO — do not merge** if the full SQL text was not directly provided in the Codex completion response, even if the SQL file exists in the repo and even if the PR is otherwise mergeable.

## DM Dashboard-specific preservation rules

Always preserve:
- DM / player / display role separation
- monster HP / hidden-info behavior outside DM view
- server-side and RLS-sensitive behavior
- mobile-first practicality
- session-first usability

Prefer Supabase RPC-backed handling for complex, rules-sensitive, or security-sensitive operations.

## Documentation rules

When rewriting support docs:
- preserve important existing knowledge
- remove stale roadmap items from Next Steps when they are clearly done
- move durable completed work into the Project Brief
- keep Workflow process-only
- keep Next Steps roadmap-only
- keep Project Brief current-state/background only

When a documentation reconciliation/update pass is requested:
- do the mandatory startup sequence first
- classify work into:
  - verified landed
  - still open / parked
  - not verified / do not document as landed
- use merged `main` and current repo files as the final decision maker

## UI density/layout investigation rule

For UI density/layout tasks, do not tune blindly.

Before making broad visual changes, first identify the dominant rendered-space drivers in the affected surface:

- biggest min-heights
- biggest paddings/gaps
- repeated stacked sections
- layout constraints preventing compaction
- low-value / high-height elements

Then target the largest contributors first.
Prefer a few deliberate reductions to many tiny scattered tweaks.

## Durable record clarification

Repo docs are the durable project record.

PR bodies may include brief summaries, but durable state/process logging belongs in:

- `docs/NEXT_STEPS.md`
- `docs/PROJECT_BRIEF.md`
- `docs/WORKFLOW.md`
- `AGENTS.md`

Use the appropriate file(s) based on roadmap, current-state, or process scope.

## Instruction refresh rule

If `AGENTS.md` or the workflow docs are changed during a task/run, do not assume the current task has picked them up.

Start a fresh task/run before relying on newly added instruction behavior.

## Non-negotiable safety rules

- Do not use `main` as an experiment surface
- Do not stack rescue fixes on broken tree states
- Do not assume production equals current GitHub state
- Do not change Vercel in a panic
- Do not force-move `main` except as explicit verified recovery
- Do not present an unverified repair as complete
- Do not merge failing recovery PRs
- Do not sign off PRs with unresolved conflicts
- Do not sign off PRs with unresolved missing-file dependency risk
- Do not assume files from earlier branches exist on a new branch
- Do not skip code-path verification on live bugs

## Expected behavior for future sessions

A future Codex/GitHub session on this repo should start by following the mandatory startup sequence above without needing the user to restate it.
