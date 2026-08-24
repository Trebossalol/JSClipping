import { app, BrowserWindow, Menu, Tray } from "electron";
import { countUnnamedClips } from "../shared/clips-store.js";
import { getTrayIcon } from "./tray-icon.js";

let tray: Tray | null = null;
let isQuitting = false;
let getAppDataDir: () => string = () => "";

export function setTrayAppDataDir(dir: string): void {
  getAppDataDir = () => dir;
}

export function markAppQuitting(): void {
  isQuitting = true;
}

export function isAppQuitting(): boolean {
  return isQuitting;
}

function showMainWindow(
  getWindow: () => BrowserWindow | null,
  createWindow: () => void,
): void {
  let win = getWindow();
  if (!win || win.isDestroyed()) {
    createWindow();
    win = getWindow();
  }
  if (!win) return;
  win.show();
  if (win.isMinimized()) win.restore();
  win.focus();
}

export function updateTrayBadge(): void {
  if (!tray) return;
  const count = countUnnamedClips(getAppDataDir());
  tray.setImage(getTrayIcon(count));
  tray.setToolTip(
    count > 0
      ? `JSClipping — ${count} unnamed clip${count === 1 ? "" : "s"}`
      : "JSClipping",
  );
}

export function createAppTray(options: {
  getWindow: () => BrowserWindow | null;
  createWindow: () => void;
}): Tray {
  const { getWindow, createWindow } = options;

  if (tray) {
    updateTrayBadge();
    return tray;
  }

  tray = new Tray(getTrayIcon(0));
  tray.setToolTip("JSClipping");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open JSClipping",
      click: () => showMainWindow(getWindow, createWindow),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", () => showMainWindow(getWindow, createWindow));
  tray.on("double-click", () => showMainWindow(getWindow, createWindow));

  updateTrayBadge();
  return tray;
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
