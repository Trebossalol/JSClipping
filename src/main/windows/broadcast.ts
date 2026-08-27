import type { BrowserWindow } from "electron";
import {
  getCutterWindow,
  getMainWindow,
  getQuickActionWindow,
} from "./state.js";

export function sendToMainWindow(channel: string, payload: unknown): void {
  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

export function windowCanShowToast(): boolean {
  const mainWindow = getMainWindow();
  return (
    mainWindow != null &&
    !mainWindow.isDestroyed() &&
    mainWindow.isVisible() &&
    !mainWindow.isMinimized()
  );
}

export function livingWindows(
  ...windows: Array<BrowserWindow | null>
): BrowserWindow[] {
  return windows.filter((win): win is BrowserWindow =>
    Boolean(win && !win.isDestroyed()),
  );
}

export function mainAndQuickActionWindows(): BrowserWindow[] {
  return livingWindows(getMainWindow(), getQuickActionWindow());
}

export function mainAndCutterWindows(): BrowserWindow[] {
  return livingWindows(getMainWindow(), getCutterWindow());
}
