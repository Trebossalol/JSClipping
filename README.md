# Easy Clip

Save the last few seconds of your game (or whatever OBS is capturing) as a clip — from a hotkey, a small on-screen **Quick Menu**, or a button in the app.

Easy Clip talks to [OBS Studio](https://obsproject.com/), saves the Replay Buffer, then trims it with FFmpeg. The cut is a stream copy (no re-encode), so it is usually done in under a second.

The app lives in the Windows tray. The interface is German; this guide is English.

---

## What you need

- Windows 10 or 11
- [OBS Studio](https://obsproject.com/) 28 or newer
- The Easy Clip installer (FFmpeg is included — you do not install it separately)

A Logitech mouse is **optional**. You can clip from the app or from a keyboard shortcut. If you have a Logitech device, you can bind a mouse button to Easy Clip’s Quick Menu in Logi Options+ (see [Logitech mouse](#logitech-mouse-optional) below). The old **Actions Ring** setup is no longer needed.

---

## Install Easy Clip

1. Open the [GitHub Releases](https://github.com/Trebossalol/easy-clip/releases) page.
2. Download **`EasyClip-Setup-….exe`** (the installer). There is also a portable **`EasyClip-Portable-….exe`** if you prefer not to install.
3. Run the installer. The default location is `C:\Program Files\EasyClip\`.
4. Start **Easy Clip** from the Start menu or the desktop shortcut.

Closing the window **does not quit** the app — it stays in the Windows tray (bottom-right, near the clock). Click the tray icon to open the window again. To fully quit, right-click the tray icon and choose **Beenden**.

The tray icon shows a red badge with the number of clips that still need a title.

---

## First-time setup

Do this once. After that, start Easy Clip, start OBS (the app can do that for you), and clip.

### 1. Enable OBS WebSocket

1. Open **OBS Studio**.
2. Go to **Tools → WebSocket Server Settings**.
3. Check **Enable WebSocket server**.
4. Leave the port at **4455** unless you know you need something else.
5. Check **Enable authentication**, pick a password, and save.
6. In Easy Clip, open **Einstellungen → OBS**.
7. Paste the same password into **Passwort** and click **Einstellungen speichern**.

The Server URL (`ws://localhost:4455`) is already correct for a normal OBS install.

### 2. Point both apps at the same folder

Clips are saved under `C:\Clips` by default, sorted into `YYYY\MM` folders.

1. In Easy Clip, open **Einstellungen → Speicher**.
2. Choose a **Clip-Ausgabeordner** (or keep `C:\Clips`).
3. In OBS: **File → Settings → Output → Recording**.
4. Set **Recording Path** to that **same folder**.
5. If Output Mode is **Advanced**, the path is on the **Recording** tab.

### 3. Turn on the Replay Buffer

Easy Clip saves the buffer — it does not invent footage that OBS has not been recording.

1. In OBS: **File → Settings → Output**.
2. If you need the Replay Buffer tab, set Output Mode to **Advanced**.
3. Open **Replay Buffer**.
4. Enable **Replay Buffer**.
5. Set **Maximum Replay Time** in Easy Clip under **Einstellungen → OBS → Aufnahme**, or in OBS itself. Easy Clip writes the value to OBS when you save.
6. Click **Apply** / **OK** if you changed it in OBS.

You can start OBS from Easy Clip: click the status pill in the top bar (**OBS starten**). That launches OBS, switches to your clip scene if you set one, applies the buffer duration, and starts the Replay Buffer.

### 4. Optional: clip scene

If you have a dedicated OBS scene for clips, pick it under **Einstellungen → OBS → Aufnahmeszene**. Easy Clip will use that scene when it starts OBS or when you save the setting. Leave it empty to keep whatever scene OBS is already on.

---

## How to clip

OBS must be running, connected (green **OBS verbunden**), and the Replay Buffer must be on. Default lengths are **30s / 1m / 5m / 10m**. You can change those under **Einstellungen → Presets** (1–6 lengths, minimum 5 seconds).

### From the app

The buttons at the top of the library save the last *N* seconds.

### Quick Menu (recommended for hotkeys)

This is the small overlay that pops up over your game.

1. Open **Einstellungen → Presets**.
2. Click the **Schnellmenü** shortcut field and press a combo that includes **Ctrl**, **Alt**, or **Windows** plus a key (for example `Ctrl+Shift+C`).
3. Save settings.

When you press that shortcut:

- Type an optional title.
- Pick a length with the mouse, the arrow keys, or **1–6**.
- **Enter** saves the highlighted length. **Esc** or a click outside closes the menu.

### Direct hotkey per length

On the same Presets page, each length can have its own shortcut. That clips immediately — no menu.

If Windows says a shortcut is already taken, pick a different combo.

---

## Logitech mouse (optional)

You do **not** need Logitech’s old **Actions Ring**. Easy Clip has its own Quick Menu.

In [Logi Options+](https://www.logitech.com/software/logi-options-plus.html):

1. Select your mouse and the button you want (often the gesture button).
2. Assign that button to the **same keyboard shortcut** you set for Easy Clip’s Quick Menu.

Pressing the button then opens the Quick Menu, even while a game is in the foreground (as long as Easy Clip is running in the tray).

If you would rather skip the menu and clip a fixed length, you can instead assign the button to **Open a file**:

| Length | File | Argument |
|---|---|---|
| 30 seconds | `C:\Program Files\EasyClip\EasyClip.exe` | `--clip 30` |
| 1 minute | same | `--clip 60` |
| 5 minutes | same | `--clip 300` |
| 10 minutes | same | `--clip 600` |

The number is seconds. If Easy Clip is already in the tray, that running copy clips; otherwise it starts, clips, and stays in the tray.

---

## Library

**Bibliothek** is your clip list:

- Thumbnails; click a clip to play it
- Edit the title to rename the file on disk
- Filter **all**, **untitled**, or **last 24 hours**
- Reveal in Explorer, open the cutter, or delete (deletes the file)

New video files dropped into the output folder (`mp4`, `mkv`, `mov`, `webm`, `m4v`) are imported automatically and moved into `YYYY\MM` if they are not already there.

---

## Clip cutter

**Schneiden** opens a separate window.

- Play the clip, mark keep-ranges on the timeline, split at the playhead
- Optionally downscale (never upscale)
- **Als neuen Clip speichern** writes a new file and leaves the original alone
- **Original überschreiben** replaces the original

---

## Settings (German labels)

| Menu | What it does |
|---|---|
| **OBS** | WebSocket server, optional `obs64.exe` path, clip scene, and Replay Buffer duration |
| **Speicher** | Output folder and how much space clips use |
| **Presets** | Clip lengths, Quick Menu shortcut, per-length hotkeys |
| **Autostart** | Not available yet — coming in a later update |
| **Über** | Author and GitHub link |

---

## Troubleshooting

| What you see | What to try |
|---|---|
| **OBS getrennt** / cannot connect | OBS is closed, WebSocket is off, or the password/port is wrong. Recheck **Tools → WebSocket Server Settings** and Easy Clip → **OBS**. |
| **Puffer aus** | Start the Replay Buffer in OBS, or use **OBS starten** from Easy Clip’s status pill. |
| Preset button greyed out / “longer than the OBS buffer” | Raise **Wiederholungspuffer** under **Einstellungen → OBS**, or shorten the preset. |
| “Wrong OBS scene” | Start OBS from Easy Clip so it switches to your clip scene, or clear the scene setting. |
| Quick Menu / hotkey does nothing | Easy Clip must be running (tray is enough). The shortcut needs Ctrl, Alt, or Windows plus a key, and must not already be used by Windows or another app. |
| Logitech button does nothing | Confirm Logi Options+ sends the same shortcut as **Schnellmenü**, and that Easy Clip is in the tray. |
| OBS will not start from the app | Easy Clip looks for `obs64.exe` under `C:\Program Files\obs-studio\…`. If yours is elsewhere, set **OBS-Programmdatei** under **Einstellungen → OBS**. |
| Clips land in the wrong place | Easy Clip’s output folder and OBS’s recording path must be the same. |

Logs (if you need them): `%APPDATA%\EasyClip\logs`.

---

## For developers

```powershell
git clone https://github.com/Trebossalol/easy-clip.git EasyClip
cd EasyClip
npm install
npm run dev
```

Packaged build (`dist/EasyClip-Setup-….exe` and the portable EXE):

```powershell
npm run dist
```

From source you need [Node.js](https://nodejs.org/) 18+. `npm install` pulls in FFmpeg; the packaged app bundles it under `resources/ffmpeg/`.
