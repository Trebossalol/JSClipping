import fs from "node:fs";
import { BrowserWindow } from "electron";
import { findClip } from "../../shared/clips/index.js";
import { IpcChannels } from "../../shared/ipc.js";
import { getAppDataDir } from "../session.js";
import { getAppIcon } from "../tray-icon.js";
import { loadRenderer, windowPrefs } from "./load.js";
import { getCutterWindow, setCutterWindow } from "./state.js";

function cutterHash(id: string): string {
  return `cut/${encodeURIComponent(id)}`;
}

export function openCutterWindow(
  id?: string,
): { ok: true } | { ok: false; error: string } {
  if (id) {
    const clip = findClip(getAppDataDir(), id);
    if (!clip) return { ok: false, error: "Clip nicht gefunden." };
    if (clip.missing || !clip.filePath || !fs.existsSync(clip.filePath)) {
      return { ok: false, error: "Die Clip-Datei fehlt." };
    }
  }

  const existing = getCutterWindow();
  if (existing && !existing.isDestroyed()) {
    existing.show();
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    if (id) {
      existing.webContents.send(IpcChannels.cutterOpenClip, id);
    }
    return { ok: true };
  }

  const cutterWindow = new BrowserWindow({
    width: 980,
    height: 860,
    minWidth: 720,
    minHeight: 640,
    title: "Schneiden",
    icon: getAppIcon(),
    show: true,
    autoHideMenuBar: true,
    webPreferences: { ...windowPrefs },
  });
  setCutterWindow(cutterWindow);
  loadRenderer(cutterWindow, id ? cutterHash(id) : "cut");
  cutterWindow.on("closed", () => {
    setCutterWindow(null);
  });
  return { ok: true };
}
