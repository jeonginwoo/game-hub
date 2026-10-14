# Lobby Conventions (TypeScript + Three.js + Vite)

> Scope: `lobby/`. Referenced from the root `CLAUDE.md`.
> Written down from the code as it stood on 2026-10-14 — every rule here is already
> followed by `lobby/src/`. A rule the code stops following is fixed here in the same
> session, or the code is fixed; a convention that describes a past state of the repo rots.
>
> **Not for games.** A game under `games/<name>/` or in its own repo follows its own
> conventions (CLAUDE.md invariant 2). The server has its own file, `server-ts.md`.
> The lobby touches `server/` in two places only: `vite.config.ts` (dev `/ws` plugin, types
> checked through `tsconfig.node.json`) and `src/` importing `server/src/protocol.ts` — the
> pure message/room-code module, shared so both ends parse the same way. Nothing else in `server/`.

## 1. Pure logic vs. wiring

- **Decisions live in pure modules.** Map parsing, movement, door/entry URLs, camera
  bounds — anything with a rule in it — is a function that imports neither `three` nor
  the DOM (`map.ts`, `movement.ts`, `entry.ts`, `view.ts`). Headless screenshots cannot
  press keys, so a rule that only exists inside the render loop cannot be tested.
- **`main.ts` is wiring only**: scene setup, input, the animation loop. It calls the pure
  modules and holds the mutable state. When a branch in `main.ts` starts deciding
  something, move the decision into a pure module.
- **HTML UI over the canvas** (entry screen, room badge) is wiring too, in its own module
  (`entry-screen.ts`); what to show is decided in a pure module (`room.ts`). Text goes in
  with `textContent`, never `innerHTML`. Storage (`localStorage`) is read/written inside
  `try/catch` and the lobby works without it. Styles live in `index.html` (`hub-` classes).
- Keyboard handlers skip events whose target is a text field (`isTyping` in `main.ts`), and an
  Enter handler on a text field ignores `isComposing` and `keyCode === 229` (Korean IME confirms
  a syllable with Enter; Safari reports only the keyCode).
- Data the lobby is configured with (map rows, game table) is its own module
  (`lobby-map.ts`, `games.ts`) — one place per kind of data.

## 2. Tests

- Vitest, one file per pure module: `lobby/test/<module>.test.ts`. Data modules
  (`games.ts`, `lobby-map.ts`) are checked in the test of the logic that consumes them.
- `describe` takes the function name, or a short topic when a group covers several
  functions or real data (`'실제 등록 표'`); `it` states the behaviour in Korean
  (`'맵 가장자리에서 멈춘다'`). A comment above a case explains a non-obvious expected value.
- Test the rule, not the picture: no Three.js objects in tests.

## 3. Types

- `tsconfig` is `strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` — keep them.
  Index results are `T | undefined`; handle it (`?? 'wall'`, early return), never `!`.
- No `any`, no `as` to silence the checker. `@ts-ignore` / `@ts-expect-error` are forbidden.
- String-literal unions instead of `enum` (`type Dir = 'up' | 'down' | 'left' | 'right'`).
- Data shapes are `interface`s with `readonly` fields; collections are `readonly T[]` and
  `Readonly<Record<K, V>>`. Return new objects instead of mutating inputs.
- Type-only imports use `import type` / inline `type` (`import { step, type Dir }`).
- Exported functions declare their return type.

## 4. Naming & constants

- Files: lowercase kebab-case (`lobby-map.ts`). Functions/variables camelCase,
  types/interfaces PascalCase, module constants `UPPER_SNAKE` (`STEP_MS`, `DOOR_GAMES`).
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
  foreground. Every mesh gets its z from `drawZ` / `objectZ` — no hand-picked z values.
- Pixel sizes are `TILE_PX` (32) and `AVATAR_PX` (48×64, feet at the cell's bottom centre).
  Pixel textures use nearest filtering, no mipmaps, sRGB (`pixelTexture` in `main.ts`).
- Drawing never blocks movement: what is passable is the character map (`#`) alone.
  An object that should block stands on `#` cells.

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
