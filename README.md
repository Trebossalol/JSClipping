# JSClipping

**Hit a Logitech Action Ring segment. Walk away with a 30s / 1m / 5m / 10m clip.**

JSClipping talks to OBS over WebSocket, dumps the Replay Buffer, then trims the last *N* seconds with FFmpeg — stream-copy, no re-encode, usually done in under a second.

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
  clip_30s.bat                    Replay …_30s.mp4
```

---

## What you get

| Action Ring segment | Script | Clip length |
|---|---|---|
| 30 seconds | [`scripts/clip_30s.bat`](scripts/clip_30s.bat) | last **30s** |
| 1 minute | [`scripts/clip_60s.bat`](scripts/clip_60s.bat) | last **60s** |
| 5 minutes | [`scripts/clip_300s.bat`](scripts/clip_300s.bat) | last **5 min** |
| 10 minutes | [`scripts/clip_600s.bat`](scripts/clip_600s.bat) | last **10 min** (full buffer) |
| Autostart OBS | [`scripts/autostart.bat`](scripts/autostart.bat) | launches OBS with Replay Buffer on, tray-minimized |

Clips land in `CLIP_OUTPUT_DIR` as `Replay YYYY-MM-DD HH-MM-SS_<seconds>s.mp4`. Each run also writes a log under `logs/`.

---

## Requirements

- Windows
- [Node.js](https://nodejs.org/) 18+ (LTS is fine)
- [OBS Studio](https://obsproject.com/) 28+ (built-in WebSocket v5)
- [FFmpeg](https://www.gyan.dev/ffmpeg/builds/) — both `ffmpeg` **and** `ffprobe` must be on your `PATH`
- A Logitech mouse/keyboard with an **Action Ring** (MX Master, MX Keys, etc.) and [Logitech Options+](https://www.logitech.com/software/logi-options-plus.html)

---

## Setup

Do these once. After that, clipping is just an Action Ring tap.

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

1. Download an **essentials** build from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) (`ffmpeg-release-essentials.zip`).
2. Extract it somewhere stable, e.g. `C:\ffmpeg`.
3. Add the `bin` folder to your user `PATH`:
   - Win + S → **Edit environment variables for your account**
   - Select **Path** → **Edit** → **New**
   - Add `C:\ffmpeg\bin` (or wherever you extracted it)
4. Close every terminal / Cursor window, open a new one, and confirm:

```powershell
ffmpeg -version
ffprobe -version
```

Both commands must print a version. If they are “not recognized”, the PATH change has not taken effect yet.

### 3. Clone and install the project

```powershell
git clone <your-repo-url> JSClipping
cd JSClipping
npm install
```

Or, if you already have the folder:

```powershell
cd C:\Users\<you>\Documents\repos\JSClipping
npm install
```

### 4. Configure environment

Copy the example env file and edit it:

```powershell
copy .env.example .env
```

Then open `.env`:

```env
OBS_URL=ws://localhost:4455
OBS_PASSWORD=CHANGE_ME
CLIP_OUTPUT_DIR=C:\\Clips
```

| Variable | Meaning |
|---|---|
| `OBS_URL` | OBS WebSocket URL. Default port is `4455`. |
| `OBS_PASSWORD` | Password from **OBS → Tools → WebSocket Server Settings**. |
| `CLIP_OUTPUT_DIR` | Where trimmed clips are written. Use `\\` for backslashes on Windows. |

`.env` is gitignored. Never commit the password.

### 5. Enable the OBS WebSocket server

1. Open OBS.
2. **Tools → WebSocket Server Settings**.
3. Enable **Enable WebSocket server**.
4. Port: `4455` (or change `OBS_URL` to match).
5. Enable **Enable authentication**.
6. Click **Show Connect Info**, copy the password into `.env` as `OBS_PASSWORD`.
7. Click **Apply**.

### 6. Turn on the Replay Buffer

JSClipping does **not** start the buffer (except via `autostart.bat`). It only *saves* it.

1. OBS → **Settings → Output**.
2. Output mode: **Advanced** (if you need the Replay Buffer tab).
3. Open the **Replay Buffer** tab.
4. Enable **Replay Buffer**.
5. Set **Maximum Replay Time** to at least **600 seconds** (10 minutes) if you want the 10-minute Action Ring slot to work.
6. Confirm **Settings → Output → Recording** (or Replay Buffer) writes into a folder you can read — the script polls the path OBS reports.
7. Click **Start Replay Buffer** (or use `scripts/autostart.bat`).

The Replay Buffer must be **running** when you clip. If it is stopped, `SaveReplayBuffer` fails.

### 7. Point autostart at your OBS install (optional)

Open [`scripts/autostart.bat`](scripts/autostart.bat) and fix the paths if OBS is not in the default location:

```bat
set OBS_PATH="C:\Program Files\obs-studio\bin\64bit\obs64.exe"
set OBS_DIR="C:\Program Files\obs-studio\bin\64bit"
```

It launches OBS with `--startreplaybuffer --minimize-to-tray`.

To run it at login:

1. Win + R → `shell:startup`
2. Create a shortcut to `scripts\autostart.bat`

---

## Logitech Options+ — Action Ring

Each `.bat` is a self-contained launcher. Link one file per Action Ring segment.

### Add the clip actions

1. Open **Logitech Options+**.
2. Select your device (MX Master, MX Keys, …).
3. Click the **Action Ring** / gesture button in the device diagram.
4. Choose **Customize Action Ring** (or **Edit Action Ring**).
5. Click an empty (or existing) segment.
6. Pick **Open application** / **Open a file** / **Run**.
7. Browse to one of these files (use the real path on your machine):

| Segment label | File |
|---|---|
| Clip 30s | `...\JSClipping\scripts\clip_30s.bat` |
| Clip 1m | `...\JSClipping\scripts\clip_60s.bat` |
| Clip 5m | `...\JSClipping\scripts\clip_300s.bat` |
| Clip 10m | `...\JSClipping\scripts\clip_600s.bat` |

8. Give the segment a short name (`30s`, `1m`, `5m`, `10m`) so you can hit it without looking.
9. Repeat for the other lengths.
10. Optional: add **Autostart OBS** pointing at `scripts\autostart.bat`.

### Tips that actually matter

- Point Options+ at the **`.bat`**, not at `node.exe`. The batch files `cd` into the repo root so `.env` and `src\` resolve correctly.
- Do **not** tick “run as administrator” unless OBS itself is elevated — a mismatch blocks the WebSocket connection.
- After changing your user `PATH` (FFmpeg), **log out or reboot** so Options+ inherits the new PATH. Action Ring launches do not see a PATH you only added to an already-open terminal.
- Keep a test segment on 30s first. Check `logs\` if nothing appears in the output folder.

### How a tap works

1. You press the Action Ring and choose a length.
2. The `.bat` runs `node src\obs_replay_clip.js <seconds>`.
3. The script connects to OBS, calls `SaveReplayBuffer`, then polls `GetLastReplayBufferReplay` until the file exists.
4. `ffprobe` reads duration; `ffmpeg -c copy` writes `…_<seconds>s.mp4` into `CLIP_OUTPUT_DIR`.
5. The full replay file OBS just saved is left in place. The trimmed clip is the extra file.

---

## Manual test (before wiring the mouse)

With OBS open and the Replay Buffer **running**:

```powershell
cd C:\Users\<you>\Documents\repos\JSClipping
node src\obs_replay_clip.js 30
```

Success looks like:

```
Connected to OBS WebSocket
SaveReplayBuffer requested
Replay file: G:\OBS Aufnahmen\Replay 2026-08-22 21-00-23.mp4 (...)
Saved 30s clip: G:\OBS Aufnahmen\Replay 2026-08-22 21-00-23_30s.mp4
```

Or double-click `scripts\clip_30s.bat`. Same thing.

---

## Project layout

```
JSClipping/
├── .env                 # local secrets (gitignored)
├── .env.example         # template
├── package.json
├── logs/                # one log file per clip run
├── scripts/
│   ├── autostart.bat    # OBS + replay buffer, minimized
│   ├── clip_30s.bat
│   ├── clip_60s.bat
│   ├── clip_300s.bat
│   └── clip_600s.bat
└── src/
    ├── obs_replay_clip.js
    ├── env.js
    └── log.js
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `spawn ffprobe ENOENT` / `spawn ffmpeg ENOENT` | FFmpeg is not on `PATH` for that process. Install it, add `bin` to user PATH, **reboot**, then retry from Action Ring. |
| `Could not connect to OBS WebSocket` | OBS is closed, WebSocket is off, wrong `OBS_PASSWORD`, or wrong port. Recheck **Tools → WebSocket Server Settings**. |
| `Could not determine saved replay buffer file path` | Replay Buffer is not running, or OBS has not flushed the file within ~10s. Start the buffer; check OBS’s replay output path. |
| Clip is shorter than requested | Buffer has not been running that long, or **Maximum Replay Time** is smaller than the segment you pressed. |
| Action Ring does nothing / flash of a console | Open the newest file in `logs\`. That is the real error. If there is no new log, Options+ is not launching the `.bat` (wrong path, or the file moved). |
| Password / URL errors at startup | `.env` is missing or empty. Copy `.env.example` and fill `OBS_PASSWORD`. |

---

## License

Personal / local tooling. Use it, fork it, clip everything.
