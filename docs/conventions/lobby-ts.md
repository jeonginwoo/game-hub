# Lobby Conventions (TypeScript + Three.js + Vite)

> Scope: `lobby/`. Referenced from the root `CLAUDE.md`.
> Written down from the code as it stood on 2026-10-14 — every rule here is already
> followed by `lobby/src/`. A rule the code stops following is fixed here in the same
> session, or the code is fixed; a convention that describes a past state of the repo rots.
>
> **Not for games.** A game under `games/<name>/` or in its own repo follows its own
> conventions (CLAUDE.md invariant 2). The server has its own file, `server-ts.md`.
> The lobby touches `server/` in two places only: `vite.config.ts` (dev `/ws` plugin, types
> checked through `tsconfig.node.json`) and `src/` importing the shared pure modules of
> `server/src/` — `protocol.ts` (messages, room code), `room-map.ts` (room data: map parsing,
> object checks, `buildRoom`; re-exports the per-kind shape table of `object-shapes.ts`) and `room-templates.ts` (room data the lobby starts from) —
> shared so both ends parse and check the same way. Nothing else in `server/`.

## Layout of `src/`

Files are grouped by feature, not by layer: a feature's pure module and its wiring module
(DOM/canvas) sit side by side in one folder. File names below are given without the folder.

| Folder | Files | What |
|--------|-------|------|
| (root) | `main.ts` | wiring: scene, input, loop |
| `world/` | `map.ts` `tiles.ts` `layers.ts` `objects.ts` `movement.ts` `view.ts` | map, draw order, movement, camera (following, first-screen drift) — all pure |
| `data/` | `object-art.ts` `object-names.ts` `games.ts` | what the lobby is configured with (art per object kind, group and shown name per object kind, game table) |
| `launch/` | `entry.ts` | game entry contract (`docs/game-entry-contract.md`) |
| `avatar/` | `look.ts` · `avatar-art.ts` | character look → drawing |
| `net/` | `net.ts` · `others.ts` | transport → what it means for the scene |
| `room/` | `room.ts` · `entry-screen.ts` | room code / name → first screen |
| `chat/` | `chat.ts` · `chat-box.ts` | chat rules → chat box |
| `hud/` | `hud.ts` · `hud-bar.ts` | roster / notice text → top-right buttons |
| `edit/` | `edit.ts` `place.ts` `paint.ts` `draft.ts` · `door-picker.ts` `edit-tools.ts` | owner's edit mode: who may edit, door marks, game choices, where an object goes / whether it may / which one is under the pointer, whether a cell may be painted / which cells a drag crosses, whether the draft has changes → door game list, tool bar (with paint brushes and save / cancel) and object list |

A new module joins the folder of the feature it serves; a new folder is made when a feature
has no home yet. `games/` is not used as a folder name (it is the repo-root games folder).

## 1. Pure logic vs. wiring

- **Decisions live in pure modules.** Map parsing, movement, door/entry URLs, camera
  bounds — anything with a rule in it — is a function that imports neither `three` nor
  the DOM (`map.ts`, `movement.ts`, `entry.ts`, `view.ts`). Headless screenshots cannot
  press keys, so a rule that only exists inside the render loop cannot be tested.
- **`main.ts` is wiring only**: scene setup, input, the animation loop. It calls the pure
  modules and holds the mutable state. When a branch in `main.ts` starts deciding
  something, move the decision into a pure module.
- **HTML UI over the canvas** (entry screen, top-right button bar with the edit/look/people/settings
  buttons and panels, chat box, door game list, edit tool bar and object list) is wiring too, each in its own module (`entry-screen.ts`, `hud-bar.ts`,
  `chat-box.ts`, `door-picker.ts`, `edit-tools.ts`); what to show is decided in a pure module (`room.ts`, `hud.ts`, `chat.ts`, `look.ts`, `edit.ts`, `place.ts`, `paint.ts`, `object-names.ts`). Icons are inline SVG drawn in code, not emoji. Text goes in
  with `textContent`, never `innerHTML`. Storage (`localStorage`) is read/written inside
  `try/catch` and the lobby works without it. Styles live in `index.html` (`hub-` classes).
- **Character drawing** is `avatar-art.ts` (2d canvas only, no `three`): a look (`look.ts` — choice
  indices, colours and labels) → one 48×64 frame. `main.ts` turns frames into textures, cached per look.
- **Networking** goes through `net.ts` only (the one file to change if the transport
  changes); every received message passes `parseServerMsg`. What the messages mean for the
  scene is the pure `others.ts`. Name tags and chat bubbles are DOM (`hub-head`, `textContent`) placed
  after `renderer.render` each frame, so the camera matrices are current.
- Keyboard handlers skip events whose target is a text field (`isTyping` in `main.ts`), and an
  Enter handler on a text field ignores `isComposing` and `keyCode === 229` (Korean IME confirms
  a syllable with Enter; Safari reports only the keyCode).
- Data the lobby is configured with (object art, object names and groups, game table) is its own module
  (`object-art.ts`, `object-names.ts`, `games.ts`) — one place per kind of data. Room data (map rows, object
  placement, door → game id) is not lobby data: it lives in `server/src/room-templates.ts` and
  is checked by `buildRoom`; the lobby adds only art (`OBJECT_ART` by kind), shown names and groups (`OBJECT_INFO` by kind) and game URLs (`GAMES`).
  The lobby draws `DEFAULT_ROOM` from the start (behind the first screen, and alone when the
  server is unreachable); the map ◀ ▶ of 「로비 만들기」 switches the backdrop to the picked template
  (`switchRoom` with a respawn, so the hidden player stands on that map's start). Behind the first screen the player is hidden and the camera drifts on its own
  (`driftCenter` in `view.ts`) at a larger zoom (`BACKDROP_ZOOM`, so a big window still has room to move);
  entering the lobby shows the player (the render loop sets its visibility each frame) and switches to `VIEW_ZOOM` and following. On entering it draws the room's template (picked on 「로비 만들기」 or
  remembered per room in `sessionStorage`, `mapKey`). When the room in `welcome` differs from what
  is drawn, `switchRoom` in `main.ts` throws the world away (`disposeWorld`), builds it again
  (`buildWorld`) and respawns; a room that fails `buildRoom` is logged and the current one kept.
  A `room` message (the owner saved an edit) goes through the same `switchRoom` without
  respawning — the player stays put unless the new walk map blocks the cell (`unstick`, below).
- **Edit mode** (owner only, `canEdit`) is a state in `main.ts`: while on, the lobby does not walk, shows only the
  map (the render loop hides every avatar; `setEditing` puts `hub-editing` on `body` so CSS hides head tags and the
  chat box, and Enter does not open chat), and the tool bar (`edit-tools.ts`, bottom centre — the top row of the map holds doors) picks one of four
  tools. A pointer on the map goes screen → cell (`screenToCell` in `view.ts`), then by tool:
  door — the door marks (part of the world, rebuilt with it) are visible, a door opens `door-picker.ts`,
  picking assigns the game (`assignDoor`); place — the chosen kind's preview follows the pointer (`placeAt`: the pointer is the
  object's bottom centre), a red fill under it when `canPlace` (`placeObject`) says no, a click places it
  (`placeObject`); remove — a red fill on `topObjectAt` (the frontmost picture over the cell), a click removes it (`removeObject`);
  paint — the bar shows four brushes (floor, wall, door, start = map characters), the world's cell marks show every
  cell (a translucent fill — walls and starts in their own colour — and a 1px grid), a white frame on the cell with a
  red fill when `paintCheck` (`paintTile`) says `no` (`same` — already that character — is not red); pressing starts a
  stroke and every cell it crosses (`cellsBetween` joins pointer moves, side by side, never diagonally) is painted
  (`paintTile`); pointer up or leaving the canvas ends the stroke.
  **Tools edit a draft, not the server** (`draft` in `main.ts`, copied from the drawn room when edit mode turns on):
  each change runs the same `room-map.ts` function the server would, a throw leaves the draft as it was, and the
  render loop rebuilds the world from the draft at most once per frame (`flushDraft`), so a long paint stroke is one
  rebuild per frame. 「저장」 (enabled only when the draft differs) sends `save{room}` and turns edit mode off keeping the
  draft on screen — the matching `room` that comes back is then a no-op; 「취소」 drops the draft and redraws the room
  from before editing. A `room` arriving mid-edit becomes that "before" room, and also the draft when the draft had no changes (`rebaseDraft` in `edit/draft.ts`). Edit mode turns off — dropping the
  draft — when ownership moves or the connection closes. While the draft differs, Esc and the edit button do not end
  edit mode (the notice says to save or cancel). The preview, the frame and the red fill are on the edit layer and are
  re-evaluated only when the pointer enters another cell, the tool changes or the world is rebuilt.
  Esc steps back one level — door game list → door tool → edit mode off; an Esc that closed a button-bar panel is
  `preventDefault`ed so it does not also step back.
- **A received room may wall a player in.** When the world changes without a respawn (`room`, edit mode turning off),
  `unstick` moves my avatar off a cell the new walk map blocks, to `nearestFloor` (fewest steps, never a door cell),
  else a start; the loop then sends `move`. Positions are client-authoritative, so each lobby fixes only itself.

## 2. Tests

- Vitest, one file per pure module, in the same folder as the source:
  `lobby/test/<folder>/<module>.test.ts` (`src/world/movement.ts` → `test/world/movement.test.ts`). Data modules
  (`games.ts`, `object-art.ts`) are checked in the test of the logic that consumes them.
- `describe` takes the function name, or a short topic when a group covers several
  functions or real data (`'실제 등록 표'`); `it` states the behaviour in Korean
  (`'맵 가장자리에서 멈춘다'`). A comment above a case explains a non-obvious expected value.
- Test the rule, not the picture: no Three.js objects in tests.

## 3. Types

- `tsconfig` is `strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` — keep them.
  `allowImportingTsExtensions` is on only because the shared `server/src/` modules import each
  other with `.ts` (Node runs them directly); lobby `src/` imports stay extensionless.
  Index results are `T | undefined`; handle it (`?? 'wall'`, early return), never `!`.
- No `any`, no `as` to silence the checker. `@ts-ignore` / `@ts-expect-error` are forbidden.
- String-literal unions instead of `enum` (`type Dir = 'up' | 'down' | 'left' | 'right'`).
- Data shapes are `interface`s with `readonly` fields; collections are `readonly T[]` and
  `Readonly<Record<K, V>>`. Return new objects instead of mutating inputs.
- Type-only imports use `import type` / inline `type` (`import { step, type Dir }`).
- Exported functions declare their return type.

## 4. Naming & constants

- Files: lowercase kebab-case (`object-art.ts`). Functions/variables camelCase,
  types/interfaces PascalCase, module constants `UPPER_SNAKE` (`STEP_MS`, `OBJECT_ART`).
- Numeric constants carry their unit in the name or a trailing comment
  (`STEP_MS = 160; // 한 칸 걷는 시간`).
- Lobby-reserved URL parameters start with `hub_` (game entry contract).

## 5. Coordinates

- Logic works in **tile units**: `x` grows right, `y` grows down (row number).
- World space: 1 unit = 1 tile, world `y = -tile y` (screen up = map top row). Convert
  only in `main.ts`; pure modules never see world coordinates.

## 6. Layers & drawing

- Draw order is ZEP-style and decided only by `layers.ts`: background (one map-sized
  image) → floor objects → sorted (objects and characters by foot y) → top objects →
  foreground → edit marks (only while editing). Every mesh gets its z from `drawZ` / `objectZ` — no hand-picked z values.
- Everything is in **cells** (`CELL_PX` 16): one map character, positions, walking,
  collision, objects, the network and world units. Art keeps its size — a sheet cell is a
  **tile** (`TILE_PX` 32) spanning `TILE_CELLS` (2) × 2 cells. `AVATAR_PX` is 48×64 (3×4 cells, feet at the cell's
  bottom centre).
  Pixel textures use nearest filtering, no mipmaps, sRGB (`pixelTexture` in `main.ts`).
- Drawing never blocks movement by itself: what is impassable is the character map's `#`,
  closed doors (no registered game — `withShutDoors`), and each object's `solid` cells
  (`withSolidObjects`), fitted to the art cell by cell.
- The map (terrain: `#` `.` `D` `S`) and objects are separate layers. An object may sit on any
  cell, `#` included; `checkObjects` only rejects `solid` cells that block a door or start, or that
  overlap another object's `solid` cells. Pictures may overlap freely.

## 7. Comments & errors

- Code comments are Korean (CLAUDE.md language rule).
- Every `src/` file opens with a 1–2 line comment: what the module is, whether it is pure, and
  the decision or document it implements (`(결정 2026-10-13: …)`, `docs/game-entry-contract.md`).
- Comments say **why** — the constraint or the bug the line prevents
  (`// 탭 전환 뒤 한 번에 여러 칸 건너뛰지 않게`), not what the code already says.
- Exported items get `/** */` only when the name does not say it all (units, `undefined`
  cases, ordering).
- `main.ts` groups code under `// --- <절> ---` separator lines.
- Thrown errors are `new Error('<한국어 설명>')` and include the offending value
  (`` `(${x}, ${y}) 의 모르는 문자 '${ch}'` ``).

## 8. Dependencies

- Runtime dependency is `three` only. Adding a package is a decision — it goes to the
  PROGRESS 결정 기록 with 근거 first.
