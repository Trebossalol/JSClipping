import { BrowserWindow } from "electron";
import { APP_NAME } from "../../shared/app.config.js";
import { startedAtLogin } from "../autostart.js";
import { getPendingClipSeconds } from "../clip-args.js";
import { isAppQuitting } from "../tray.js";
import { getAppIcon } from "../tray-icon.js";
import { loadRenderer, windowPrefs } from "./load.js";
import { getMainWindow, setMainWindow } from "./state.js";

export function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 980,
    height: 780,
    minWidth: 720,
    minHeight: 560,
    title: APP_NAME,
    icon: getAppIcon(),
    show: !startedAtLogin() && getPendingClipSeconds() == null,
    webPreferences: { ...windowPrefs },
  });
  setMainWindow(mainWindow);

  loadRenderer(mainWindow);

  mainWindow.on("close", (event) => {
    if (!isAppQuitting()) {
      event.preventDefault();
      getMainWindow()?.hide();
    }
  });

  mainWindow.on("closed", () => {
    setMainWindow(null);
  });
}

export function showMainWindow(): void {
  const existing = getMainWindow();
  if (existing && !existing.isDestroyed()) {
    existing.show();
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    return;
  }
  createMainWindow();
}
