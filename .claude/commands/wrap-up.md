---
description: End a session — verify, review, record, commit, merge
---

End the current session. Calling `/wrap-up` is the user's approval to commit and merge —
the work stayed uncommitted until now so the user's fixes land in the same commit.

1. Run `bash scripts/verify.sh`. If it fails, fix it first — never wrap up red.
2. For a non-trivial diff, run the `reviewer` agent and resolve BLOCKER/MAJOR findings.
3. Update `docs/PROGRESS.md`:
   - 현재 상태 (진행 위치 · 다음 작업 · 차단 요소)
   - 세션 로그 entry (use the 형식 template, newest on top) — say what was NOT verified
   - any new decisions → 결정 기록, always with 근거
   - follow-up work discovered → 후보 일감
4. If `CLAUDE.md` drifted from reality during this session, fix it now.
5. Commit in the format from CLAUDE.md — one commit for the task. On a task branch, first fold
   any `wip:` commits in (`git reset --soft $(git merge-base main HEAD)`). On `main`, just the
   `docs:` commit for the PROGRESS update. Never end a session with uncommitted work.
6. Merge the task branch into `main` (`docs/conventions/git-workflow.md` §2): `--ff-only`; if
   `main` moved, rebase, re-run `bash scripts/verify.sh`, then merge. Delete the branch and
   confirm with `git log --oneline -3 main`.
   `design/` and `experiment/` branches are committed but never merged here — the user picks.
