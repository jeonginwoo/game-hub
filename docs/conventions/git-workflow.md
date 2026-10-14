# Git Workflow

> Model: `main` + short-lived task branches, merged only with the user's approval.
> Referenced from the root `CLAUDE.md`. AI agents follow the same rules as the human.
> Decided 2026-10-14 (PROGRESS 결정 기록: 디자인 시안 브랜치 → 모든 작업 브랜치 → 이 문서의 세부).

## 1. Branches

- **No commit lands on `main` directly** — code, docs and harness changes alike.
  Every task starts with `git switch main && git switch -c <type>/<short-name>`.
- **Naming**: `<type>/<short-name>`, type = the commit type of the work
  (`feat/` `fix/` `refactor/` `test/` `docs/` `chore/`). Examples: `feat/zep-layers`,
  `chore/branch-workflow`.
- **Design 시안** use `design/<name>` (`design/lobby`, `design/zep-style`). Several can
  live side by side, all cut from `main`; only the one the user picks is merged, the rest
  stay as branches. Throwaway experiments use `experiment/<name>`.
- **Branch from `main`**, never from another task branch — a stacked branch drags the
  base branch's unmerged work into its diff.
- One task = one branch = one commit (CLAUDE.md). A follow-up found mid-task goes to
  후보 일감, not onto the same branch.

## 2. Merging

- **Merge only on the user's explicit yes.** `/wrap-up` asks after committing; without a
  yes the branch stays as it is.
- Method: `git switch main && git merge --ff-only <branch>`. If `main` moved and the
  fast-forward fails, rebase the branch onto `main`, re-run `bash scripts/verify.sh`, then merge.
- Delete the local branch after merging (`git branch -d`). Design 시안 that lost are kept.
- After merging, `git log --oneline -3 main` must show the commit.

## 3. Commits

- Format: `type: 한국어 요약`, then `- ` bullet lines (CLAUDE.md).
- `bash scripts/verify.sh` is green before every commit.
- A harness rule change is its own `chore:` commit/branch, merged before the work that needs it.

## 4. Remote

- `origin` = GitHub `jeonginwoo/game-hub`. Push only when the user asks.
- No force push to `main`. A task branch that was pushed is force-pushed only with
  `--force-with-lease`.
