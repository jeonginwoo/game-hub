---
description: Start a session — restore state, plan before code
---

Start a work session.

Reply to the user in Korean throughout this session (plans, questions, reports).
Code, identifiers and file paths stay as they are.

1. Read `docs/PROGRESS.md` — current state, decision log, work queue, 후보 일감.
2. Run `git log --oneline -5` and `git status` to confirm the state matches PROGRESS.
   If they disagree, say so before anything else — PROGRESS is fixed first.
3. If the next task depends on an open question, raise it now — the user decides
   whether to proceed on an assumption or wait.
4. Present a plan for the next task (or the task the user gives) and wait for
   user approval before writing any code or harness file.
   Read the `docs/conventions/` file for the area you will touch before planning.
   Once approved, cut the task branch from `main` (`docs/conventions/git-workflow.md`) before the first edit.
5. Keep the unit of work small: one feature/fix = one session = one commit.

## Loop mode (`/next --loop` — used by scripts/ralph.sh, no human approval)

1. Read `docs/PROGRESS.md`. Take the FIRST unchecked `- [ ]` item in 작업 큐.
   If the queue is empty, stop immediately. If the current branch is `main`, stop —
   the human picks the branch before starting the loop.
2. Implement exactly that one item, tests first where tests exist. If you discover
   follow-up work, append it to 후보 일감 — never to the queue, and never do it silently.
3. Run `bash scripts/verify.sh` until green.
4. Check the item off, add a one-line session log entry, commit.
5. STOP. Never take a second item.
