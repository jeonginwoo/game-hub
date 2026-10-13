# game-hub — a Three.js multiplayer lobby (쯔꾸르 style) that opens into games each member builds

<!-- Admission test for every line in this file — keep a line only if all three hold:
     (1) always true  (2) needed every session  (3) not derivable from the code.
     Fails one → delete it or move it under docs/. State rules as must/never, not "is".
     No empty sections, no speculative parts: a section appears when its pain is felt. -->

Runs in the browser on Three.js. The lobby is a top-down, RPG-Maker-like map where players
walk around together and enter a game through a door; each game is built separately by one
member, in whatever form they choose, and plugged into the lobby afterwards.
This repo is NOT a game engine or a shared framework for the games — the lobby only opens them.

## Session start

Read `docs/PROGRESS.md` first — current state, 열린 질문, decision log, work queue, next task.

## Commands

```bash
bash scripts/verify.sh            # full verification (--quick: fast tier)
                                  # full log → build/last-verify.log; on FAIL read only the failing part
bash scripts/ralph.sh 2           # autonomous queue loop — only with a human watching
npm run dev                       # lobby dev server (Vite, http://localhost:5173)
npm install                       # once after clone, and whenever package-lock.json changes
bash scripts/shot.sh              # look at the lobby: headless screenshot → build/shot/lobby.png (skill: run-lobby)
```

## Layout

One repo, npm workspaces (root `package.json`): `lobby/` (Three.js + Vite + TypeScript), `server/` (Node + ws —
not yet), `games/<name>/` (one per game, any stack — reached by URL only). A folder is created in the session that
first needs it. Root `typecheck`/`build` fan out with `--workspaces --if-present`, so a game without those scripts
is simply skipped.

## Structure rules (invariants — never write code that violates them)

1. The lobby and the games are independent: the lobby never imports a game's internals, and a
   game never imports the lobby or another game. They meet only at the **game entry contract**
   (how the lobby launches a game and how the player comes back) — defined once, in
   `docs/game-entry-contract.md`. Lobby code that launches or receives a game follows it exactly.
2. A game's form is free. The lobby must never require a game to use its stack, scene graph, or
   input handling — the lobby adapts to the contract, never the game to the lobby.

## Way of working

- One task = one session = one commit. Keep the unit small enough to review in one diff.
- Never claim a task done unless `bash scripts/verify.sh` passes. On FAIL, read only
  the failing part of `build/last-verify.log` (grep/tail) — never the whole log.
- Say what you could NOT verify (visual result, live multiplayer behaviour) instead of implying it works.
- Work discovered mid-task goes to 후보 일감 in `docs/PROGRESS.md` — never done silently.
- Decisions that change or contradict a document go to the PROGRESS decision log with 근거,
  and the contradicted document is fixed in the same session.
- Harness parts are added only when their pain is felt — no empty sections, no speculative parts.
  A harness rule change is its own `chore:` commit, landed before the work that needs it.
- The `reviewer` agent never runs on the author's model — its `model:` stays pinned to a
  different family (blind-spot separation; `scripts/verify.sh` checks it).
- Language: instruction files (this file, commands, agents, scripts) in English;
  records (`docs/`) and code comments in Korean.
- Commit message: `type: 한국어 요약` (+ `- ` bullet lines). Types: `feat` `fix` `refactor` `test` `docs` `chore`.
