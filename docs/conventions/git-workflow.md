# Git Workflow

> Model: `main` + short-lived task branches, merged only with the user's approval.
> Referenced from the root `CLAUDE.md`. AI agents follow the same rules as the human.
> Decided 2026-10-14 (PROGRESS 결정 기록: 디자인 시안 브랜치 → 모든 작업 브랜치 → 이 문서의 세부).

## 1. Branches

- **No code or rule change lands on `main` directly.** Every such task starts with
  `git switch main && git switch -c <type>/<short-name>`. "Rule" = CLAUDE.md, `docs/conventions/`,
  `.claude/`, `scripts/`, and `docs/game-entry-contract.md`.
- **Exception — record-only doc edits go straight to `main`** (`docs:` commit right away,
  `bash scripts/verify.sh` green first, no `/wrap-up` needed, nothing to merge): PROGRESS updates (state, session log, 후보 일감, a decision-log
  entry recording a decision already made), and typo or stale-line fixes in `docs/` records.
  If the edit changes what anyone must do, it is a rule change — use a branch.
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

- **The user calling `/wrap-up` is the approval.** `/wrap-up` commits and merges in one go —
  no separate question. Before that, nothing is merged.
- **Exception — `design/` and `experiment/` are never merged by `/wrap-up`.** It commits on
  the branch and stops; only the 시안 the user picks is merged, on their explicit word.
- Method: `git switch main && git merge --ff-only <branch>`. If `main` moved and the
  fast-forward fails, rebase the branch onto `main`, re-run `bash scripts/verify.sh`, then merge.
- Delete the local branch after merging (`git branch -d`). Design 시안 that lost are kept.
- After merging, `git log --oneline -3 main` must show the commit.

## 3. Commits

- **Commit task branches only at `/wrap-up`** (record-only docs on `main` excepted, §1). When the work is done, report it
  and leave it uncommitted: the user's review fixes then land in the same commit instead of
  a `fix:` right behind it. If a session must stop before `/wrap-up`, a `wip: <요약>` commit on
  the task branch is allowed; `/wrap-up` folds it into the task commit
  (`git reset --soft $(git merge-base main HEAD)`). Loop mode (ralph) commits per item.
- Format: `type: 한국어 요약`, then `- ` bullet lines (CLAUDE.md).
- `bash scripts/verify.sh` is green before every commit.
- A harness rule change is its own `chore:` commit/branch, merged before the work that needs it.

## 4. Remote

- `origin` = GitHub `jeonginwoo/game-hub`. Push only when the user asks.
- **Pushing `main` deploys** when it touches `lobby/`, `server/`, `package*.json` or
  `scripts/deploy-vm.sh` (`.github/workflows/deploy.yml` → the Oracle VM, `docs/deploy.md`).
  A deploy restarts the server, which wipes every room's in-memory edits — say so when pushing.
- No force push to `main`. A task branch that was pushed is force-pushed only with
  `--force-with-lease`.
