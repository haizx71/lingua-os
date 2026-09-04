# Git Worktree Workflow

Use this after the repository has a valid initial Git commit.

## Goal

Keep Codex and Gemini from overwriting each other's uncommitted files while allowing both to work in parallel.

## Suggested setup

From the main integration checkout:

```bash
git branch codex/core
git branch gemini/ui
git worktree add ../lingua-codex codex/core
git worktree add ../lingua-gemini gemini/ui
```

Then:

- open Codex in `../lingua-codex`
- open Gemini in `../lingua-gemini`
- keep the original checkout for integration/review

## Shared-file rule

Files such as contracts, `TASKS.md`, `STATUS.md` and `DECISIONS.md` are merge-sensitive.

Prefer small commits and sync before editing a shared file. Contract changes should normally originate from Codex tasks.

## Integration

After a task is verified, commit it on the agent branch. Merge or cherry-pick into the integration branch after review.

Do not use force pushes or destructive resets as part of normal agent workflow.
