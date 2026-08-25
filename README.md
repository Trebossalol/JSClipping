# Easy Clip

**Hit a Logitech Action Ring segment. Walk away with a clip.**

Easy Clip talks to OBS over WebSocket, dumps the Replay Buffer, then trims the last *N* seconds with FFmpeg — stream-copy, no re-encode, usually done in under a second.

The **Electron app** sits in the Windows tray, shows OBS connection status, lets you clip from the UI, browse a library with thumbnails, rename/delete files, and cut clips down further without leaving the app.

```
┌─────────────┐     SaveReplayBuffer      ┌─────┐
│ Action Ring │ ─────────────────────────▶│ OBS │
│  EasyClip   │                           └─────┘
│  --clip 30  │                                │
└─────────────┘                                ▼
       │                              Replay 2026-08-22.mp4
       │                                       │
       │              ffmpeg -c copy (last N s)│
       ▼                                       ▼
  EasyClip.exe --clip 30        CLIP_OUTPUT_DIR\YYYY\MM\…_30s.mp4
       │
       ▼
  Library (folder watcher)  →  rename / cut / delete
```

---

## Features

- **Instant replay clips** — last 30s / 1m / 5m / 10m by default, or any length you configure (minimum 5 seconds, up to 6 presets)
- **Logitech Action Ring** — one segment per length; if Easy Clip is already in the tray, that instance clips
- **Library** — thumbnails, play, rename (renames the file), reveal in Explorer, delete, filter untitled clips
- **Clip cutter** — pick keep-ranges on a timeline, split at the playhead, save a new file (still stream-copy)
- **OBS status** — connected / disconnected, replay buffer on/off, max buffer length, auto-reconnect
- **Autostart** — Windows logon launches Easy Clip, then OBS with Replay Buffer on and minimized to tray
- **Storage** — output folder plus disk usage of clips vs. free space
- **Single instance** — a second `EasyClip.exe --clip 30` is handed to the running process

Clips land in `CLIP_OUTPUT_DIR\YYYY\MM\` as `Replay YYYY-MM-DD HH-MM-SS_<seconds>s.mp4`. Each CLI / `--clip` run also writes a log (`logs/` in the repo from source; `%APPDATA%\EasyClip\logs` when packaged). After a successful trim, Easy Clip tries to delete the full OBS replay dump so you only keep the cut.

The UI is German; this README is English.

---

## Windows installer (recommended)

Build a real EXE. After install, the only external requirement is **OBS Studio**.

```powershell
npm install
npm run dist
```

Artifacts land in `dist/`:

| File | What it is |
|---|---|
| `EasyClip-Setup-1.0.0.exe` | NSIS installer (default: `C:\Program Files\EasyClip\EasyClip.exe`) |
| `EasyClip-Portable-1.0.0.exe` | Portable EXE (no install) |

**Action Ring (packaged):** Open file = `EasyClip.exe`, argument = `--clip 30` (or `60` / `300` / `600`, or any other length in seconds). If the app is already in the tray, that instance clips; otherwise it starts, clips, and stays in the tray.

FFmpeg and ffprobe are bundled next to the app (`resources/ffmpeg/`). OBS stays a separate install.

**Autostart (packaged):** enabling it in Settings registers Windows logon to launch `EasyClip.exe --started-at-login`. The app then starts OBS with `--startreplaybuffer --minimize-to-tray` if OBS is not already running.

---

## Requirements

- Windows
- [OBS Studio](https://obsproject.com/) 28+ (built-in WebSocket v5)
- **Packaged app:** nothing else (FFmpeg is bundled)
- **From source:** [Node.js](https://nodejs.org/) 18+ (LTS is fine). `npm install` pulls in FFmpeg binaries via `ffmpeg-static` / `ffprobe-static` — no PATH install needed
- A Logitech mouse/keyboard with an **Action Ring** (MX Master, MX Keys, etc.) and [Logitech Options+](https://www.logitech.com/software/logi-options-plus.html) — optional if you only use the in-app buttons

---

## Setup

### 1. Install Node.js (from source only)

1. Download the LTS installer from [nodejs.org](https://nodejs.org/).
2. Run it. Leave “Add to PATH” checked.
3. Confirm in a **new** terminal:

```powershell
node -v
npm -v
```

### 2. Clone and install

```powershell
git clone https://github.com/Trebossalol/JSClipping.git EasyClip
cd EasyClip
npm install
```

### 3. Configure settings

Settings live in **`%APPDATA%\EasyClip\config.json`** (shared by the Electron app, Action Ring, and `clip.bat`).

**Easiest:** start the app and fill in Settings:

```powershell
npm run dev
```

| Field | Meaning |
|---|---|
| OBS WebSocket URL | Default `ws://localhost:4455` |
| OBS password | From **OBS → Tools → WebSocket Server Settings** |
| Clip output folder | Where trimmed clips are written (`YYYY\MM` subfolders are created automatically). Point this at the **same folder OBS uses for Replay Buffer files**. |
| Clip presets | Buttons in the library (1–6 lengths, minimum 5 seconds). Action Ring / CLI still pass seconds as an argument. |
| Autostart | Launch Easy Clip + OBS (Replay Buffer, tray) at Windows logon |

First launch writes defaults (`ws://localhost:4455`, password `CHANGE_ME`, output `C:\Clips`, presets `30 / 60 / 300 / 600`) into AppData until you change them in Settings.

### 4. Enable the OBS WebSocket server

1. Open OBS.
2. **Tools → WebSocket Server Settings**.
3. Enable **Enable WebSocket server**.
4. Port: `4455` (or change the URL to match).
5. Enable **Enable authentication**.
6. Click **Show Connect Info**, copy the password into Easy Clip → Settings → **OBS Verbindung**.
7. Click **Apply**.

### 5. Turn on the Replay Buffer

Easy Clip does **not** start the buffer unless Autostart is on (or you click start OBS from the app). It only *saves* it.

1. OBS → **Settings → Output**.
2. Output mode: **Advanced** (if you need the Replay Buffer tab).
3. Open the **Replay Buffer** tab.
4. Enable **Replay Buffer**.
5. Set **Maximum Replay Time** to at least as long as your longest preset (e.g. **600 seconds** for 10 minutes).
6. Set the Replay Buffer recording path to the same folder as Easy Clip’s output folder.
7. Click **Start Replay Buffer** (or enable Autostart in Easy Clip).

### 6. Point Easy Clip at a non-default OBS install (optional)

Packaged autostart looks for `obs64.exe` under `C:\Program Files\obs-studio\…` (and the x86 Program Files equivalent). If yours lives elsewhere, set the `OBS_PATH` environment variable to the full path of `obs64.exe`.

From source, [`scripts/autostart.bat`](scripts/autostart.bat) is the fallback — edit `OBS_PATH` there if needed.

---

## Using the app

```powershell
npm run dev
```

Closing the window **keeps the app in the Windows tray**. Click the tray icon to show the window again; use **Beenden** in the tray menu to quit. The tray icon shows a red badge with the count of clips that still need a title; renaming a clip clears it from that count.

### Library

- Preset buttons in the header clip the last *N* seconds from the OBS Replay Buffer
- Grid of recent clips with thumbnails — click to play in your system player
- Edit the title to rename the file on disk
- Filter **all** vs **untitled**
- Reveal in Explorer, open the cutter, or delete (deletes the file)

The app watches the output folder and imports new video files automatically (`mp4`, `mkv`, `mov`, `webm`, `m4v`), moving them into `YYYY\MM` if they are not already there.

### Clip cutter

Opens a separate window. Keep one or more ranges, split a range at the playhead, then save. The original file is left alone; the result is a new file named `… (cut).mp4` in the same folder and added to the library. Still stream-copy — no re-encode.

### Settings

| Section | What it does |
|---|---|
| **OBS Verbindung** | WebSocket URL and password |
| **Speicher** | Output folder, disk usage of clips vs. free space on that drive |
| **Presets** | Library button lengths (capped by the OBS Replay Buffer max when connected) |
| **Autostart** | Windows logon: Easy Clip + OBS with Replay Buffer, minimized to tray |

---

## Logitech Options+ — Action Ring

**Packaged (recommended):** Open application / Open a file = `C:\Program Files\EasyClip\EasyClip.exe`. Argument:

| Segment label | Argument |
|---|---|
| Clip 30s | `--clip 30` |
| Clip 1m | `--clip 60` |
| Clip 5m | `--clip 300` |
| Clip 10m | `--clip 600` |

`--clip=30` works too. The number is seconds, not limited to those four — use whatever matches your presets.

**From source:** point Options+ at `scripts\clip.bat` with argument `30` / `60` / `300` / `600` (not `node.exe`). The batch file `cd`s into the repo root and runs the local `tsx` binary.

---

## Manual CLI test

With OBS open and the Replay Buffer **running**:

```powershell
npm run clip -- 30
```

Or `scripts\clip.bat 30`. Same thing.

Clips are written under `CLIP_OUTPUT_DIR\YYYY\MM\`.

---

## Project layout

```
EasyClip/
├── package.json
├── electron.vite.config.ts
├── electron-builder.yml
├── LICENSE
├── scripts/
│   ├── autostart.bat         # OBS --startreplaybuffer --minimize-to-tray
│   ├── clip.bat              # clip.bat 30 | 60 | 300 | 600 (dev)
│   └── copy-ffmpeg.mjs       # copies bundled binaries before dist
├── logs/                     # CLI logs when running from source
└── src/
    ├── cli/
    │   └── obs_replay_clip.ts
    ├── shared/
    │   ├── config.ts         # AppData config.json
    │   ├── clip-service.ts   # save+trim and cut (ffmpeg -c copy)
    │   ├── clips/            # library index, import, rename, delete, cut
    │   └── …
    ├── main/                 # Electron main process, tray, autostart
    ├── preload/
    └── renderer/             # Electron UI (React + shadcn/ui)
```

App data (`%APPDATA%\EasyClip\`):

| File | What it is |
|---|---|
| `config.json` | OBS URL, password, output folder, presets, autostart |
| `clips.json` | Library index |
| `thumbnails\` | JPEG previews |
| `logs\` | Clip logs when packaged |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `spawn ffprobe ENOENT` / `spawn ffmpeg ENOENT` | From source: run `npm install`. Packaged: reinstall the app (binaries live in `resources/ffmpeg`). |
| `Could not connect to OBS WebSocket` / red status pill | OBS is closed, WebSocket is off, wrong password/port. Recheck **Tools → WebSocket Server Settings** and Easy Clip Settings. |
| `Could not determine saved replay buffer file path` | Replay Buffer is not running, or OBS has not flushed the file within ~10s. Match Easy Clip’s output folder to OBS’s Replay Buffer path. |
| Preset button disabled / “longer than the OBS buffer” | Raise **Maximum Replay Time** in OBS, or shorten the preset. |
| Action Ring does nothing | Packaged: confirm the argument is `--clip 30`. From source: open the newest file in `logs\` and confirm `node_modules\.bin\tsx.cmd` exists (`npm install`). |
| Autostart does not launch OBS | Confirm `obs64.exe` is in the default Program Files path, or set `OBS_PATH`. |
| Settings / clips not shared with CLI | Both must use `%APPDATA%\EasyClip\config.json`. |

---

## License

[MIT](LICENSE). Use it, fork it, clip everything. The software is provided **as is**, with **no warranty**. You keep any risk; the author is not liable for anything that happens if you use it.
