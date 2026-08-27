import type { BrowserWindow } from "electron";

let mainWindow: BrowserWindow | null = null;
let cutterWindow: BrowserWindow | null = null;
let quickActionWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function setMainWindow(win: BrowserWindow | null): void {
  mainWindow = win;
}

export function getCutterWindow(): BrowserWindow | null {
  return cutterWindow;
}

export function setCutterWindow(win: BrowserWindow | null): void {
  cutterWindow = win;
}

export function getQuickActionWindow(): BrowserWindow | null {
  return quickActionWindow;
}

export function setQuickActionWindow(win: BrowserWindow | null): void {
  quickActionWindow = win;
}
