---
name: run-lobby
description: Launch the lobby dev server and look at it — headless Chrome screenshot via scripts/shot.sh (no chromium-cli or Playwright on this machine)
---

# Run the lobby and look at it

One command does the whole loop — start the dev server if needed, capture a frame, print the
page's console, stop what it started:

```bash
bash scripts/shot.sh            # http://localhost:5173/
bash scripts/shot.sh "/?x=1"    # any path/query on the dev server
```

Then **Read `build/shot/lobby.png` and look at it.** A blank or solid-colour frame is a failure
to render, even if the exit code is 0. The console section must show only Vite's
`[vite] connecting...` / `connected.` lines; the script exits non-zero on any console error.

## What it proves / does not prove

- Proves: the page loads, the Three.js scene draws (WebGL on SwiftShader, software), nothing threw.
- Does not prove: GPU performance, HMR, keyboard/mouse interaction, multiple clients.
- Headless `--screenshot` cannot send input. When a check needs key presses (walking, doors),
  extend `scripts/shot.sh` with Chrome's `--remote-debugging-port` + a small CDP script
  (`Input.dispatchKeyEvent`, `Page.captureScreenshot`) — not built yet, add it when first needed.

## Gotchas (all hit on 2026-10-09/13, Windows 11 + Git Bash)

- Root `npm run dev` is `npm run dev -w lobby`; npm does not forward flags, so
  `npm run dev -- --port 1234` makes Vite exit on "Unused args". Run `npx vite` inside `lobby/`
  if you need flags.
- Stop a server you started by killing the port listener, not the npm wrapper:
  `netstat -ano | grep ':5173.*LISTENING'` → `taskkill //F //PID <pid>`.
- Chrome must get `--user-data-dir` or it hands the URL to the running desktop Chrome and exits.
- `--virtual-time-budget=4000` is what lets the render loop produce a frame before capture.
