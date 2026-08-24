# JSClipping

**Hit a Logitech Action Ring segment. Walk away with a 30s / 1m / 5m / 10m clip.**

JSClipping talks to OBS over WebSocket, dumps the Replay Buffer, then trims the last *N* seconds with FFmpeg — stream-copy, no re-encode, usually done in under a second.

The **Electron companion** shows OBS connection status, lets you edit settings, create clips from the UI, and browse recent clips with thumbnails and editable titles.

```
┌─────────────┐     SaveReplayBuffer      ┌─────┐
│ Action Ring │ ─────────────────────────▶│ OBS │
│  .bat file  │                           └─────┘
└─────────────┘                                │
       │                                       ▼
       │                              Replay 2026-08-22.mp4
       │                                       │
       │              ffmpeg -c copy (last N s)│
       ▼                                       ▼
  clip.bat 30               CLIP_OUTPUT_DIR\YYYY\MM\…_30s.mp4
       │
       ▼
  Electron Recent Clips (watcher)
```

---

## What you get

| Action Ring segment | Script | Clip length |
|---|---|---|
| 30 seconds | [`scripts/clip.bat`](scripts/clip.bat) `30` | last **30s** |
| 1 minute | [`scripts/clip.bat`](scripts/clip.bat) `60` | last **60s** |
| 5 minutes | [`scripts/clip.bat`](scripts/clip.bat) `300` | last **5 min** |
| 10 minutes | [`scripts/clip.bat`](scripts/clip.bat) `600` | last **10 min** (full buffer) |
| Autostart OBS | [`scripts/autostart.bat`](scripts/autostart.bat) | launches OBS with Replay Buffer on, tray-minimized |

Clips land in `CLIP_OUTPUT_DIR\YYYY\MM\` as `Replay YYYY-MM-DD HH-MM-SS_<seconds>s.mp4`. Renaming a clip in Electron also renames the file. Each CLI run also writes a log under `logs/`.

---

## Requirements

- Windows
- [Node.js](https://nodejs.org/) 18+ (LTS is fine)
- [OBS Studio](https://obsproject.com/) 28+ (built-in WebSocket v5)
- [FFmpeg](https://www.gyan.dev/ffmpeg/builds/) — both `ffmpeg` **and** `ffprobe` must be on your `PATH`
- A Logitech mouse/keyboard with an **Action Ring** (MX Master, MX Keys, etc.) and [Logitech Options+](https://www.logitech.com/software/logi-options-plus.html) (optional if you only use the Electron buttons)

---

## Setup

### 1. Install Node.js

1. Download the LTS installer from [nodejs.org](https://nodejs.org/).
2. Run it. Leave “Add to PATH” checked.
3. Confirm in a **new** terminal:

```powershell
node -v
npm -v
```

### 2. Install FFmpeg (required)

Without this you will see `spawn ffprobe ENOENT` and the clip will fail after OBS saves the replay.

```powershell
winget install "FFmpeg (Essentials Build)"
```

Close every terminal / Cursor window, open a new one, and confirm:

```powershell
ffmpeg -version
ffprobe -version
```

### 3. Clone and install the project

```powershell
git clone <your-repo-url> JSClipping
cd JSClipping
npm install
```

### 4. Configure settings

Settings live in **`%APPDATA%\JSClipping\config.json`** (shared by the Electron app and Action Ring / `clip.bat`).

**Easiest:** start the app and fill in Settings:

```powershell
npm run dev
```

| Field | Meaning |
|---|---|
| OBS WebSocket URL | Default `ws://localhost:4455` |
| OBS password | From **OBS → Tools → WebSocket Server Settings** |
| Clip output folder | Where trimmed clips are written (`YYYY\MM` subfolders are created automatically) |

**Migration:** if you still have a repo `.env` from older versions, the first launch copies those values into AppData and then uses the JSON file going forward.

Optional one-time `.env` (migration only):

```env
OBS_URL=ws://localhost:4455
OBS_PASSWORD=CHANGE_ME
CLIP_OUTPUT_DIR=C:\\Clips
```

### 5. Enable the OBS WebSocket server

1. Open OBS.
2. **Tools → WebSocket Server Settings**.
3. Enable **Enable WebSocket server**.
4. Port: `4455` (or change the URL to match).
5. Enable **Enable authentication**.
6. Click **Show Connect Info**, copy the password into the Electron Settings panel.
7. Click **Apply**.

### 6. Turn on the Replay Buffer

JSClipping does **not** start the buffer (except via `autostart.bat`). It only *saves* it.

1. OBS → **Settings → Output**.
2. Output mode: **Advanced** (if you need the Replay Buffer tab).
3. Open the **Replay Buffer** tab.
4. Enable **Replay Buffer**.
5. Set **Maximum Replay Time** to at least **600 seconds** (10 minutes) if you want the 10-minute Action Ring slot to work.
6. Click **Start Replay Buffer** (or use `scripts/autostart.bat`).

### 7. Point autostart at your OBS install (optional)

Open [`scripts/autostart.bat`](scripts/autostart.bat) and fix the paths if OBS is not in the default location.

---

## Electron companion

```powershell
npm run dev
```

The window shows:

- **OBS connected / disconnected** status (auto-reconnect)
- **Clip buttons** (30s / 1m / 5m / 10m)
- **Settings** editor (writes `%APPDATA%\JSClipping\config.json`)
- **Recent clips** grid with thumbnails — click to open in your system player; edit the title to rename the file on disk

Closing the window **keeps the app in the Windows tray**. Click the tray icon (or Open) to show the window again; use **Quit** in the tray menu to exit. The tray icon shows a red badge with the count of clips that still need a title; renaming a clip clears it from that count.

Action Ring clips still go through `clip.bat`. The Electron app watches the output folder and adds new files to Recent Clips automatically.

---

## Logitech Options+ — Action Ring

Each `.bat` is a self-contained launcher. Link one file per Action Ring segment.

1. Open **Logitech Options+**.
2. Select your device → **Action Ring** → customize a segment.
3. Pick **Open application** / **Open a file** / **Run**.
4. Browse to `...\JSClipping\scripts\clip.bat`.
5. Set the argument:

| Segment label | File | Argument |
|---|---|---|
| Clip 30s | `...\JSClipping\scripts\clip.bat` | `30` |
| Clip 1m | `...\JSClipping\scripts\clip.bat` | `60` |
| Clip 5m | `...\JSClipping\scripts\clip.bat` | `300` |
| Clip 10m | `...\JSClipping\scripts\clip.bat` | `600` |

Point Options+ at the **`.bat`**, not at `node.exe`. The batch file `cd`s into the repo root and runs the local `tsx` binary so TypeScript CLI code works without a global install.

---

## Manual CLI test

With OBS open and the Replay Buffer **running**:

```powershell
cd C:\Users\<you>\Documents\repos\JSClipping
npm run clip -- 30
```

Or `scripts\clip.bat 30`. Same thing.

Clips are written under `CLIP_OUTPUT_DIR\YYYY\MM\`.

---

## Project layout

```
JSClipping/
├── package.json
├── electron.vite.config.ts
├── scripts/
│   ├── autostart.bat
│   └── clip.bat              # clip.bat 30 | 60 | 300 | 600
├── logs/                     # one log file per CLI clip run
└── src/
    ├── cli/
    │   └── obs_replay_clip.ts
    ├── shared/
    │   ├── config.ts         # AppData config.json
    │   ├── clip-service.ts
    │   ├── clips-store.ts
    │   └── …
    ├── main/                 # Electron main process
    ├── preload/
    └── renderer/             # Electron UI (React + shadcn/ui)
```

App data (`%APPDATA%\JSClipping\`):

- `config.json` — OBS URL, password, output folder
- `clips.json` — recent-clips index
- `thumbnails\` — JPEG previews

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `spawn ffprobe ENOENT` / `spawn ffmpeg ENOENT` | FFmpeg is not on `PATH`. Install it, reboot, retry. |
| `Could not connect to OBS WebSocket` / red status pill | OBS is closed, WebSocket is off, wrong password/port. Recheck **Tools → WebSocket Server Settings** and Electron Settings. |
| `Could not determine saved replay buffer file path` | Replay Buffer is not running, or OBS has not flushed the file within ~10s. |
| Action Ring does nothing | Open the newest file in `logs\`. Confirm `node_modules\.bin\tsx.cmd` exists (`npm install`). |
| Settings / clips not shared with CLI | Both must use `%APPDATA%\JSClipping\`. Do not keep editing a stale `.env` after migration. |

---

## License

Personal / local tooling. Use it, fork it, clip everything.
