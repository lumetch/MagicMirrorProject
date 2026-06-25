# MMM-Vulnera Design Spec

**Date:** 2026-06-25  
**Status:** Approved

## Context

Vulnera is a web application running at `api.vulnera.ch`. Its `/health` endpoint exposes the status of two backing services (PostgreSQL database and Elasticsearch). The goal is a MagicMirror² module on Page 1 (`bottom_left`) that gives an at-a-glance health status — readable across the room, no interaction required.

## Health API Contract

```
GET https://api.vulnera.ch/health

200 → {"status": "healthy", "checks": {"database": "ok", "search": "ok"}}
503 → {"status": "degraded", "checks": {"database": "ok"|"unavailable", "search": "ok"|"unavailable"}}
```

Possible states:
| HTTP | database    | search      | Display state |
|------|-------------|-------------|---------------|
| 200  | ok          | ok          | healthy       |
| 503  | unavailable | ok          | degraded      |
| 503  | ok          | unavailable | degraded      |
| 503  | unavailable | unavailable | down          |
| any  | (network/parse error)       | error        |

## Design: Traffic Light

```
┌─────────────────────────────┐
│   VULNERA MONITORING        │
│                             │
│         ◉  (pulsing glow)   │
│      HEALTHY                │
│                             │
│  ● Database      OK         │
│  ● Search        OK         │
│                             │
│  Last check: 14:23:01       │
└─────────────────────────────┘
```

**Color scheme:**
- Large indicator: green (healthy) / amber (degraded — one service down) / red (down — both or error)
- Sub-check dots: green (ok) / red (unavailable)
- Pulsing glow animation on the main indicator
- Dark glass-card background consistent with other modules (e.g., MMM-PhilipsHue)

**States displayed:**
- `HEALTHY` — green
- `DEGRADED` — amber (one service unavailable)
- `DOWN` — red (both services unavailable)
- `ERROR` — red (network failure or unexpected HTTP status)
- `LOADING...` — grey (first load before any response)

## Architecture

**`modules/MMM-Vulnera/` (new directory)**

| File | Purpose |
|------|---------|
| `MMM-Vulnera.js` | Frontend module — builds DOM, receives socket data |
| `node_helper.js` | Backend — polls `/health` every 60s via Node.js `fetch()` |
| `MMM-Vulnera.css` | Styling — indicator circle, sub-check dots, pulse animation |

**Data flow:**
```
Frontend start() ──VULNERA_START──> node_helper
                                         │
                                   fetch() every 60s
                                         │
                 <──VULNERA_STATUS── sendSocketNotification()
                   {httpStatus, status, checks, timestamp}
                         │
                    updateDom()
```

**Payload shape sent from node_helper:**
```js
{
  httpStatus: 200,                         // raw HTTP status
  status: "healthy" | "degraded" | "error",
  checks: {
    database: "ok" | "unavailable",
    search: "ok" | "unavailable"
  },
  timestamp: "14:23:01"                    // formatted HH:MM:SS
}
```

## Config Integration

Add to `config/config.js.sample`:

1. New module entry in the Page 1 section:
```js
{
  module: "MMM-Vulnera",
  position: "bottom_left",
  header: "Vulnera Monitoring",
  config: {
    url: "https://api.vulnera.ch/health",
    refreshInterval: 60 * 1000
  }
}
```

2. Add `"MMM-Vulnera"` to the page 1 list in `MMM-pages`:
```js
["clock", "weather", "calendar", "MMM-JarvisAmbient", "newsfeed", "MMM-Vulnera"],
```

## CSS Details

- `.vulnera-wrapper`: flex column, centered
- `.vulnera-indicator`: 56px circle, `border-radius: 50%`, `box-shadow` for glow, colored via `.healthy` / `.degraded` / `.down` / `.error` / `.loading` modifier classes
- `@keyframes vulnera-pulse`: subtle scale + opacity pulse on the glow shadow
- `.vulnera-status-text`: large, bold, colored to match indicator
- `.vulnera-checks`: flex column, left-aligned, margin-top
- `.vulnera-dot`: 10px circle, inline, green/red
- `.vulnera-timestamp`: small, `var(--color-text-dimmed)`

## Verification

1. Start MagicMirror: `npm start`
2. Confirm module appears in `bottom_left` on Page 1
3. With endpoint reachable: large green circle + HEALTHY + green dots
4. Simulate 503 by temporarily pointing URL to a mock or unreachable host → red/amber state
5. Check Last check timestamp updates every 60s
