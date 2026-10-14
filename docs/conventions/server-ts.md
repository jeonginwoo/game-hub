# Server Conventions (Node + TypeScript + ws)

> Scope: `server/`. Referenced from the root `CLAUDE.md`.
> Written down from the code as it stood on 2026-10-14 (first server commit). Same rot rule as
> `lobby-ts.md`: a rule the code stops following is fixed here or in the code, in the same session.
>
> **Not for games.** A game's own server (e.g. whiteboard-3d's `/ws`) follows its own repo.
> The lobby server never carries a game's messages (CLAUDE.md invariant 1).

## 1. Shape

- **Pure modules** hold the rules: `protocol.ts` (message types + `parseClientMsg`, imports
  neither `node:*` nor the DOM, so the lobby can reuse it) and `roster.ts` (who is in, relay).
  They are tested without sockets.
- **Wiring** is `ws.ts` (`attachLobby` — upgrades on `WS_PATH` only, heartbeat) and `main.ts`
  (deploy entry: serves `lobby/dist` + `/ws` on one port, `PORT` env).
- Dev and deploy share `attachLobby`: dev attaches it to the Vite server through
  `lobby/vite.config.ts`. Besides that, lobby `src/` may import `protocol.ts` — so it must
  stay free of `node:*`, `ws` and the DOM.
- Every socket and stream gets an `'error'` listener (`ws.on('error', …)`, `pipeline(…, cb)`):
  an unhandled `'error'` kills the process — in dev, Vite with it.
- `attachLobby` leaves other upgrade paths alone (Vite HMR needs them); whoever owns the
  HTTP server ends unclaimed upgrades (`main.ts` destroys them).

## 2. Protocol

- Connect URL is `/ws?room=<code>`. The code format (`isRoomCode`) lives in `protocol.ts`;
  a missing or malformed code is refused at the upgrade with 400. A room exists while
  someone is in it (`Rooms` in `roster.ts`) — no create call, no persistence.
- JSON over WebSocket, one object per message, discriminated by `t`.
- Positions are client-authoritative, in **tile units** (`x` right, `y` down — same as
  `lobby-ts.md` §5). The server checks shape and bounds only; it never knows the map.
- Every incoming message goes through `parseClientMsg`; a malformed one is dropped silently
  (no error reply). It returns new objects holding only known fields.
- The first message must be `hello`; anything before it is dropped. Changing a message is a
  protocol change — note it in the PROGRESS 결정 기록 and change both ends in one commit.

## 3. Runtime

- Node ≥ 22.18 runs `.ts` directly (type stripping) — no build step, no `tsx`.
  So: `erasableSyntaxOnly` (no `enum`, no parameter properties, no `namespace`), and
  relative imports carry the `.ts` extension (`./roster.ts`).
- Mutable state lives inside a class (`Roster`) behind methods; message objects are
  `readonly` and replaced, never mutated (`me.info = { ...me.info, ...at }`).

## 4. Shared with `lobby-ts.md`

These sections apply unchanged: §2 Tests (Vitest, `server/test/<module>.test.ts`; a socket
test may open a real port on `0`), §3 Types, §4 Naming & constants, §7 Comments & errors.
Dependencies: runtime `ws` only — adding another is a 결정 기록 entry first.
