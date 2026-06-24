# MagicMirror² — Swiss Home Office Mirror Design Spec

**Date:** 2026-06-23
**Hardware:** Raspberry Pi 3B · IP 172.16.22.123 · SSH key /home/lumetch/.ssh/id_mir
**Display:** Portrait (1080×1920), HDMI, wall-mounted in home office
**Location:** Switzerland
**Language:** English

---

## Context

A fresh MagicMirror² v2.36.0 install on a Raspberry Pi 3B. The mirror hangs in a home office in Switzerland. The Pi has a microphone and speaker. The house uses Ubiquiti networking and Philips Hue lights. The goal is a production-grade smart mirror with Swiss-relevant content, Hue light control, and an offline Jarvis-style voice assistant — all within the constraints of the Pi 3B's 1GB RAM.

---

## Module List

### Default (built-in)

| Module | Position | Config highlights |
|---|---|---|
| `alert` | (global) | Required by other modules |
| `clock` | top_left | 24h, timezone: Europe/Zurich |
| `weather` | top_right + bottom_left | Provider: openmeteo, no API key, Swiss coordinates; two instances (current + forecast) |
| `calendar` | upper_third | Google Calendar iCal URL |
| `newsfeed` | lower_third | Feeds: SwissInfo.ch English RSS + BBC World RSS |
| `updatenotification` | top_bar | Default config |
| `compliments` | bottom_right | Custom Swiss-appropriate strings |

### Third-Party (install from GitHub)

| Module | Repo | Role |
|---|---|---|
| `MMM-PublicTransportHafas` | hermannsblum/MMM-PublicTransportHafas | SBB train departures via HAFAS API |
| `MMM-Remote-Control` | Jopyth/MMM-Remote-Control | Browser-based mirror admin at /remote.html |
| `MMM-pages` | edward-shen/MMM-pages | Two-page rotation (60s interval) |
| `MMM-ModuleScheduler` | aidanheerdegen/MMM-ModuleScheduler | Hide transit module during night hours |

### Custom (build as part of this project)

| Module | Location |
|---|---|
| `MMM-PhilipsHue` | modules/MMM-PhilipsHue |
| `MMM-LocalAssistant` | modules/MMM-LocalAssistant |

---

## Portrait Layout

Display rotation set at OS level (`display_rotate=1` in `/boot/firmware/config.txt`). Electron sees a native portrait viewport. Custom CSS (`config/custom.css`) tightens padding for the narrow column.

### Page 1 — Information (default, in rotation)

```
┌─────────────────────────────┐
│ top_bar   UpdateNotification│
├──────────────┬──────────────┤
│ top_left     │ top_right    │
│ Clock        │ Weather Now  │
├─────────────────────────────┤
│ upper_third                 │
│ Calendar (next 3 events)    │
├─────────────────────────────┤
│ middle_center               │
│ SBB Departures (next 4)     │
├─────────────────────────────┤
│ lower_third                 │
│ NewsFeed (scrolling)        │
├──────────────┬──────────────┤
│ bottom_left  │ bottom_right │
│ Weather 5d   │ Compliments  │
├─────────────────────────────┤
│ bottom_bar  Alert           │
└─────────────────────────────┘
```

### Page 2 — Smart Home (in rotation)

```
┌─────────────────────────────┐
│ top_bar   Clock (compact)   │
├─────────────────────────────┤
│ upper_third                 │
│ MMM-PhilipsHue room states  │
├─────────────────────────────┤
│ middle_center               │
│ Voice response display      │
├─────────────────────────────┤
│ lower_third                 │
│ (reserved: air quality)     │
└─────────────────────────────┘
```

### Jarvis Overlay — Voice Active State (not in rotation)

Triggered programmatically by `MMM-LocalAssistant`. Covers all pages.

```
┌─────────────────────────────┐
│                             │
│                             │
│      ◉ ◎ ○  arc rings       │
│    ≋≋≋≋≋≋≋≋  waveform       │
│                             │
│  > LISTENING...             │
│  > "turn on office lights"  │
│  > Office lights are on.    │
│                             │
└─────────────────────────────┘
```

**States and colors:**
- `LISTENING` — cyan `#00d4ff`, concentric rings pulse, live mic waveform bars
- `PROCESSING` — amber `#ffaa00`, rotating dashed radar arc, bouncing dots
- `SPEAKING` — green `#00ff88`, rings pulse to TTS amplitude, response text types in character-by-character

**Implementation:** `MMM-LocalAssistant` injects `<div id="jarvis-overlay">` into DOM. CSS `@keyframes` only — no canvas, no WebGL. Overlay triggered via `notificationReceived("ASSISTANT_ACTIVE")` and dismissed via `ASSISTANT_IDLE`.

---

## Custom Module: MMM-PhilipsHue

### Purpose
Show Philips Hue room light states on Page 2. Accept voice commands to toggle rooms. Talk directly to the local Hue Bridge REST API — no Philips cloud dependency.

### One-time Pairing
A setup script (`scripts/hue-pair.js`) prompts the user to press the Hue Bridge button, then calls `POST /api` to register and stores the returned `username` token in the module config.

### Data Flow

```
node_helper.js ──GET /api/{username}/groups──▶ Hue Bridge (LAN, every 30s)
               ◀── { roomName, on, bri } ──────
               broadcasts SOCKET notification to frontend

MMM-LocalAssistant ──sendNotification("HUE_COMMAND", {room, action})──▶ MMM-PhilipsHue
MMM-PhilipsHue node_helper ──PUT /api/{username}/groups/{id}/action──▶ Hue Bridge
```

### Display

```
💡 OFFICE        [ON]   ████████░░
💡 LIVING ROOM   [OFF]  ░░░░░░░░░░
💡 BEDROOM       [ON]   █████░░░░░
```

Room name + on/off badge + brightness bar. Clicking a room card sends toggle command.

### Config Shape

```js
{
  module: "MMM-PhilipsHue",
  position: "upper_third",  // Page 2 only via MMM-pages
  config: {
    bridgeIp: "192.168.x.x",  // discovered via discovery.meethue.com
    username: "abc123...",     // from pairing script
    pollInterval: 30000,
    rooms: ["Office", "Living Room", "Bedroom"]
  }
}
```

---

## Custom Module: MMM-LocalAssistant

### Purpose
Offline voice assistant with Jarvis-style overlay. Wake word → STT → rule-based command dispatch → TTS. No LLM (Pi 3B 1GB RAM constraint); all responses are derived from live module state or templated strings.

### Component Stack

| Component | Tool | Notes |
|---|---|---|
| Wake word | Picovoice Porcupine (Node SDK) | "Hey Mirror", free tier, fully offline, ~3% CPU |
| Audio capture | `node-mic` + SoX | Raw PCM from USB/3.5mm mic |
| STT | `whisper.cpp` tiny.en model | ~40MB, ~2s latency on Pi 3B, spawned as child process |
| Command dispatch | Rule-based regex matcher | Instant, no inference needed |
| TTS | `espeak-ng` | Near-zero latency, spawned as child process |
| Overlay | CSS `@keyframes` SVG | Runs in Electron renderer process |

### Data Flow

```
Microphone
    │
    ▼
node_helper.js
  ├─ porcupine listens continuously
  ├─ on wake: capture 5s audio → whisper.cpp → transcribed text
  ├─ match text against command rules → response string + side-effects
  ├─ espeak-ng speaks response
  └─ socketNotification at each state: LISTENING / PROCESSING / SPEAKING / IDLE

MMM-LocalAssistant.js (renderer)
  ├─ on LISTENING → show overlay (cyan state)
  ├─ on PROCESSING → amber state
  ├─ on SPEAKING + {text} → green state, type text into overlay
  ├─ on IDLE → fade overlay out
  └─ on HUE_COMMAND → sendNotification to MMM-PhilipsHue
```

### Supported Voice Commands

| Phrase pattern | Action |
|---|---|
| `turn on [room] lights` | `HUE_COMMAND {room, on: true}` |
| `turn off [room] lights` | `HUE_COMMAND {room, on: false}` |
| `turn off all lights` | `HUE_COMMAND {room: "all", on: false}` |
| `what's the weather` | Read current weather from DOM / module state |
| `what's my next meeting` | Read next calendar event |
| `next train to [destination]` | Read from MMM-PublicTransportHafas data |
| `go to sleep` / `sleep` | `sendNotification("REMOTE_ACTION", {action: "MONITOROFF"})` |
| `wake up` | `sendNotification("REMOTE_ACTION", {action: "MONITORON"})` |

### Config Shape

```js
{
  module: "MMM-LocalAssistant",
  position: "bottom_bar",
  config: {
    whisperPath: "/home/pi/whisper.cpp/main",
    whisperModel: "/home/pi/whisper.cpp/models/ggml-tiny.en.bin",
    porcupineAccessKey: "...",  // free from picovoice.ai
    wakeWord: "hey mirror",
    captureSeconds: 5,
    espeakVoice: "en-gb",
    micDevice: "default"
  }
}
```

---

## Raspberry Pi Setup Sequence

### Prerequisites
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential \
  libasound2-dev sox espeak-ng fonts-noto-color-emoji
```

### Node.js 22
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### MagicMirror²
```bash
git clone https://github.com/MagicMirrorOrg/MagicMirror.git ~/MagicMirror
cd ~/MagicMirror && npm run install-mm
cp config/config.js.sample config/config.js
```

### Portrait Rotation
Add to `/boot/firmware/config.txt` (`1` = 90° clockwise, `3` = 90° counter-clockwise — choose based on which way the cable exits the display):
```
display_rotate=1
```

### Third-Party Modules
```bash
cd ~/MagicMirror/modules
for repo in \
  hermannsblum/MMM-PublicTransportHafas \
  Jopyth/MMM-Remote-Control \
  edward-shen/MMM-pages \
  aidanheerdegen/MMM-ModuleScheduler; do
  git clone https://github.com/$repo
  npm install --prefix $(basename $repo)
done
```

### whisper.cpp (STT engine)
```bash
git clone https://github.com/ggerganov/whisper.cpp ~/whisper.cpp
cd ~/whisper.cpp && make
bash models/download-ggml-model.sh tiny.en
```

### Autostart (systemd user service)
```ini
# ~/.config/systemd/user/magicmirror.service
[Unit]
Description=MagicMirror²
After=graphical-session.target

[Service]
Type=simple
WorkingDirectory=/home/pi/MagicMirror
ExecStart=/usr/bin/npm start
Restart=on-failure
Environment=DISPLAY=:0

[Install]
WantedBy=default.target
```
```bash
systemctl --user enable --now magicmirror
```

---

## Verification Checklist

| Check | Method |
|---|---|
| Portrait display | Mirror boots in portrait, MagicMirror fills screen vertically |
| All modules load | No red error boxes at `http://172.16.22.123:8080` |
| Weather | Correct city + temperature for Swiss location |
| SBB departures | Real departure times for configured station |
| Calendar | Google Calendar events appear on Page 1 |
| News | SwissInfo + BBC headlines scroll |
| Page rotation | Pages 1 → 2 cycle every 60 seconds |
| Hue pairing | Setup script returns API username without error |
| Hue display | Page 2 shows correct on/off state per room |
| Hue voice command | "Hey Mirror, turn off office lights" → lights respond |
| Wake word | "Hey Mirror" triggers Jarvis overlay instantly |
| Jarvis animation | Overlay covers all modules, arc rings animate in cyan |
| STT | Spoken phrase appears as transcribed text on overlay |
| TTS | espeak-ng responds through speaker |
| Jarvis dismiss | After response, overlay fades, normal mirror resumes |
| Night schedule | Transit module hides after configured hour |
| Remote control | `172.16.22.123:8080/remote.html` works from phone |

---

## Open Questions / Future Scope

- **Nearest SBB station** — must be specified in config before SBB module works
- **Google Calendar iCal URL** — must be generated from Google Calendar settings
- **Hue Bridge IP** — discoverable via `https://discovery.meethue.com` on LAN
- **Picovoice API key** — free account at picovoice.ai (single device, offline use)
- **Air quality (Page 2 reserved slot)** — OpenAQ covers Swiss stations; can be added later
- **Ollama LLM** — feasible if later upgraded to Pi 4/5; architecture already supports it via command dispatcher extension
