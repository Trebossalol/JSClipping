import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { APP_NAME } from "../shared/app.config.js";
import { isPackagedApp } from "../shared/paths.js";

/**
 * Windows logon registration for packaged builds only.
 *
 * Enabling autostart writes a login item:
 *   EasyClip.exe --started-at-login
 *
 * `LOGIN_FLAG` is how the next process knows it was opened by Windows, not by
 * the user. Electron's `wasOpenedAtLogin` is unreliable on Windows when the
 * login item uses a custom path/args, so the CLI flag is the real signal.
 *
 * That signal only controls window visibility (stay in the tray). Starting OBS
 * is a separate `config.AUTOSTART` path in the main process.
 *
 * Unpackaged (`npm run dest`) never registers a login item. Older dest builds
 * used wscript + `start-at-login.vbs` to run `npm start`; those leftovers are
 * removed on launch without touching a packaged EasyClip.exe login item.
 */
export const LOGIN_FLAG = "--started-at-login";

function launcherVbsPath(appDataDir: string): string {
  return path.join(appDataDir, "start-at-login.vbs");
}

function wscriptPath(): string {
  return path.join(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32",
    "wscript.exe",
  );
}

function removeLoginLauncher(appDataDir: string): void {
  const vbsPath = launcherVbsPath(appDataDir);
  if (fs.existsSync(vbsPath)) {
    fs.unlinkSync(vbsPath);
  }
}

/**
 * Unregister the old dest login item only.
 * Pass the same path/args used when it was created so a packaged
 * `EasyClip.exe` entry under the same name is left alone.
 */
function removeDevLoginItem(appDataDir: string): void {
  removeLoginLauncher(appDataDir);
  try {
    app.setLoginItemSettings({
      openAtLogin: false,
      path: wscriptPath(),
      args: [`"${launcherVbsPath(appDataDir)}"`],
      name: APP_NAME,
    });
  } catch {
    // Registry may be locked; packaged login item is left alone.
  }
}

/** True when this process was launched by Windows logon (hide the main window). */
export function startedAtLogin(): boolean {
  if (process.argv.includes(LOGIN_FLAG)) return true;
  try {
    return app.getLoginItemSettings().wasOpenedAtLogin === true;
  } catch {
    return false;
  }
}

/**
 * Register or remove Easy Clip from Windows logon.
 * No-op on non-Windows. Unpackaged runs only clean up leftover dest launchers.
 */
export function setAppAutostartEnabled(
  enabled: boolean,
  appDataDir: string,
): void {
  if (process.platform !== "win32") return;

  if (!isPackagedApp()) {
    removeDevLoginItem(appDataDir);
    return;
  }

  if (!enabled) {
    app.setLoginItemSettings({
      openAtLogin: false,
      name: APP_NAME,
    });
    removeLoginLauncher(appDataDir);
    return;
  }

  removeLoginLauncher(appDataDir);
  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath("exe"),
    args: [LOGIN_FLAG],
    name: APP_NAME,
  });
}
