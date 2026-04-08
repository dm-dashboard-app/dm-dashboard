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

### GitHub-only execution guardrail (critical)

All implementation work for this repo must be executed against the live GitHub repository/branch and resulting PRs must be mergeable from GitHub UI.

If a session environment is not actually connected to GitHub (for example: no configured git remote, no connector write path, or no ability to create/open a real GitHub PR), do **not** continue coding on a local-only branch as if it were live work.

In that case:
- stop implementation immediately
- clearly report the missing GitHub connection state
- provide only a proposed patch/plan until live GitHub write path is available

Never present local-only commits as merge-ready GitHub work.

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
