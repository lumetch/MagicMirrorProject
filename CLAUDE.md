# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install (production)
npm run install-mm

# Install (development, also installs Playwright)
npm run install-mm:dev

# Start (Wayland / Linux)
npm start
npm run start:dev        # with DevTools

# Start (X11)
npm run start:x11
npm run start:x11:dev

# Start (Windows)
npm run start:windows

# Server-only mode (no Electron, headless)
npm run server

# Validate config before starting
npm run config:check

# Tests
npm test                 # all tests
npm run test:unit        # unit tests only
npm run test:e2e         # end-to-end tests only
npm run test:electron    # Electron tests only
npm run test:watch       # watch mode
npm run test:coverage    # with coverage report

# Linting and formatting
npm run lint:js          # ESLint (auto-fix)
npm run lint:css         # Stylelint (auto-fix)
npm run lint:prettier    # Prettier (auto-fix)
npm run test:js          # ESLint (check only)
npm run test:css         # Stylelint (check only)
```

## Architecture

MagicMirror² is an Electron app that wraps a local Express/Socket.io web server. Each "module" has two halves that communicate via Socket.io:

**Server side (Node.js):**

- `js/app.js` — entry point; spawns the HTTP server and loads node_helpers
- `js/server.js` — Express server, serves static files, manages socket namespaces
- `js/node_helper.js` — base class for module server-side logic; subclassed by each module's `node_helper.js`
- `serveronly/` — bootstrap for server-only mode (no Electron)

**Client side (browser/Electron renderer):**

- `js/electron.js` — Electron main process; creates `BrowserWindow`, calls `js/app.js`
- `js/main.js` — `MM` singleton; orchestrates DOM creation, module positioning, notification bus
- `js/module.js` — `Module` base class (via `Class.extend()`); all frontend modules extend this
- `js/loader.js` — dynamically loads module JS/CSS files and starts modules
- `js/socketclient.js` — `MMSocket` wrapper around socket.io that routes notifications to modules
- `js/translator.js` — loads JSON translation files; template syntax is `{variableName}`
- `clientonly/` — bootstrap for client-only mode

**Module system:**

- Default modules live in `defaultmodules/` (alert, calendar, clock, compliments, helloworld, newsfeed, updatenotification, weather)
- Third-party modules go in `modules/` (excluded from linting)
- Each module directory contains: `<name>.js` (frontend), optionally `node_helper.js` (backend), `<name>.css`, translation files, and Nunjucks templates (`.njk`)

**Communication patterns:**

- Module ↔ Module: `this.sendNotification(notification, payload)` / `notificationReceived(notification, payload, sender)`
- Module ↔ NodeHelper: `this.sendSocketNotification(notification, payload)` / `socketNotificationReceived(notification, payload)` (in both directions)

**Module lifecycle:**

- Frontend: `init()` → `start()` → `getDom()` (returns HTMLElement or Promise)
- NodeHelper: `init()` → `loaded()` → `start()` → `socketNotificationReceived()`

**Config (`config/config.js`):**

- Copied from `config/config.js.sample` to create; validated with `npm run config:check`
- Key fields: `address`, `port` (default 8080), `ipWhitelist`, `language`, `units`, `modules[]`
- Each module entry: `{ module: "name", position: "top_left", header: "...", config: { ... } }`
- Valid positions: `top_bar`, `top_left`, `top_center`, `top_right`, `upper_third`, `middle_center`, `lower_third`, `bottom_left`, `bottom_center`, `bottom_right`, `bottom_bar`, `fullscreen_above`, `fullscreen_below`
- Environment overrides: `MM_CONFIG_FILE`, `MM_PORT`, `mmFetchTimeout`

## Code Style

- **Indentation**: tabs (enforced by ESLint `@stylistic/indent`)
- **Quotes**: double quotes for JS strings
- **Semicolons**: required
- **Trailing commas**: none (Prettier config)
- **JSDoc**: required on all functions (enforced by `eslint-plugin-jsdoc`)
- The `config/` and `modules/` directories are excluded from linting

## Testing

Tests use **Vitest** and run **sequentially** (maxWorkers: 1) because all suites share port 8080 and temp file fixtures. Three test projects:

- `tests/unit/` — fast Node.js unit tests (`_spec.js` files), timeout 20s
- `tests/e2e/` — Playwright browser tests, timeout 60s
- `tests/electron/` — Electron integration tests, timeout 120s

To run a single test file:

```bash
npx vitest run tests/unit/classes/translator_spec.js
```

## Branching Model

- `develop` — active development branch; PRs target here
- `master` — releases only; tagged with `v2.x.x`
- Never merge your own PRs
