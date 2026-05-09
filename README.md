# QuickDrop

A lightweight clipboard manager and temporary notepad that lives in your system tray. Built for speed — open it in a keystroke, paste from history without lifting your hands off the keyboard.

## Features

- **Scratch notepad** — Alt+Space to open a frameless, always-on-top text editor for temporary notes
- **Clipboard history** — Ctrl+Shift+V to summon a floating popup of your recent clipboard entries
- **Keyboard-first** — navigate history with arrow keys, press Enter to paste
- **Auto-paste** — clicking or selecting a history item pastes it directly into whatever you were typing
- **Configurable** — set history limit (10 / 50 / 100 / 500), change the main shortcut, enable run-on-startup
- **System tray** — runs silently in the background, double-click the tray icon to show the notepad

## Installation

```bash
git clone <repo-url>
cd quickdrop
npm install
npm start
```

## Build a distributable

```bash
npm run build
```

The `prebuild` script automatically generates `icon.png` and `icon.ico` from scratch before packaging. No manual icon setup needed.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Alt+Space | Toggle notepad |
| Ctrl+Shift+V | Open / close clipboard history |
| Escape | Close any open window |
| Arrow Up / Down | Navigate history items |
| Enter | Paste selected history item |

## Tech stack

| | |
|---|---|
| [Electron](https://www.electronjs.org/) 41 | Desktop shell |
| [sharp](https://sharp.pixelplumbing.com/) | Programmatic icon generation |
| [Vitest](https://vitest.dev/) | Unit tests |
| [electron-builder](https://www.electron.build/) | Windows NSIS installer |

## Running tests

```bash
npm test
```

Tests cover `sanitizeText` (clipboard input sanitization) and `mergeSettings` (settings validation logic) in [src/utils.js](src/utils.js).

## Security

- `contextIsolation: true` — renderer processes are fully isolated from Node.js
- `nodeIntegration: false` — no Node APIs exposed in renderer
- `preload-main.js` / `preload-popup.js` expose only the minimal API surface needed via `contextBridge`
- Content Security Policy headers on both HTML pages block inline scripts and unauthorized external resources
- Clipboard content is sanitized (control characters stripped, 100k character cap) before being written back to the clipboard

## Design decisions

**Two preload files instead of one** — `preload-main.js` covers the notepad window; `preload-popup.js` covers the history popup. This keeps each window's API surface minimal. The popup preload also enforces a channel allowlist for incoming IPC events.

**Programmatic icon generation** — `build-icon.js` uses `sharp.create` to draw the icon entirely in memory. No source image file needed in the repository; running `npm run build` (or `node build-icon.js`) produces identical output on any machine.

**No bundler** — For a single-purpose tray utility this size, webpack/vite adds complexity without meaningful benefit. The source files load directly.

**`focusable: false` on the history popup** — The popup uses `showInactive()` so it appears without stealing focus from the active application. Arrow key navigation is handled via `globalShortcut` in the main process, so the popup never needs focus to accept keyboard input.
