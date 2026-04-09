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

## Mandatory completion-log merge-readiness gate

Implementation PRs are **not merge-ready** until all of the following are true in that same PR:
- the Completion Log Update section is fully filled out
- any required support-doc updates are included (`docs/NEXT_STEPS.md`, `docs/PROJECT_BRIEF.md`, and `docs/WORKFLOW.md` when process changed)
- any support doc intentionally left unchanged is explicitly marked N/A with a reason in the PR body

Do not sign off or present a PR as ready before this gate is satisfied.

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
