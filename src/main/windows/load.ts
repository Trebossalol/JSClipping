import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BrowserWindow } from "electron";

/**
 * Paths are relative to the bundled main entry (`out/main/index.js`),
 * not this source file. electron-vite inlines this module into that bundle.
 */
const preloadPath = fileURLToPath(
  new URL("../preload/index.mjs", import.meta.url),
);

export const windowPrefs = {
  preload: preloadPath,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false,
} as const;

export function loadRenderer(win: BrowserWindow, hash?: string): void {
  if (process.env.ELECTRON_RENDERER_URL) {
    const base = process.env.ELECTRON_RENDERER_URL;
    void win.loadURL(hash ? `${base}#${hash}` : base);
    return;
  }
  void win.loadFile(
    join(__dirname, "../renderer/index.html"),
    hash ? { hash } : undefined,
  );
}
