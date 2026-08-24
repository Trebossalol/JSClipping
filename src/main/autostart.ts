import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { APP_NAME, getRepoRoot, isPackagedApp } from "../shared/paths.js";

const LOGIN_ENV = "JSCLIPPING_STARTED_AT_LOGIN";
export const LOGIN_FLAG = "--started-at-login";

function launcherVbsPath(appDataDir: string): string {
  return path.join(appDataDir, "start-at-login.vbs");
}

function vbsQuote(value: string): string {
  return value.replace(/"/g, '""');
}

function writeLoginLauncher(appDataDir: string): string {
  const repo = getRepoRoot();
  const vbsPath = launcherVbsPath(appDataDir);
  const obsBat = path.join(repo, "scripts", "autostart.bat");
  const content = [
    'Set sh = CreateObject("WScript.Shell")',
    `sh.CurrentDirectory = "${vbsQuote(repo)}"`,
    `sh.Run """${vbsQuote(obsBat)}""", 0, False`,
    `sh.Run "cmd.exe /d /c set ${LOGIN_ENV}=1&& npm run start", 0, False`,
    "",
  ].join("\r\n");
  fs.writeFileSync(vbsPath, content, "utf8");
  return vbsPath;
}

function removeLoginLauncher(appDataDir: string): void {
  const vbsPath = launcherVbsPath(appDataDir);
  if (fs.existsSync(vbsPath)) {
    fs.unlinkSync(vbsPath);
  }
}

export function startedAtLogin(): boolean {
  if (process.argv.includes(LOGIN_FLAG)) return true;
  if (process.env[LOGIN_ENV] === "1") return true;
  try {
    return app.getLoginItemSettings().wasOpenedAtLogin === true;
  } catch {
    return false;
  }
}

/** Register or remove JSClipping (+ OBS clip mode) from Windows logon. */
export function setAppAutostartEnabled(
  enabled: boolean,
  appDataDir: string,
): void {
  if (process.platform !== "win32") return;

  if (!enabled) {
    app.setLoginItemSettings({
      openAtLogin: false,
      name: APP_NAME,
    });
    removeLoginLauncher(appDataDir);
    return;
  }

  if (isPackagedApp()) {
    removeLoginLauncher(appDataDir);
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath("exe"),
      args: [LOGIN_FLAG],
      name: APP_NAME,
    });
    return;
  }

  const vbsPath = writeLoginLauncher(appDataDir);
  const wscript = path.join(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32",
    "wscript.exe",
  );
  app.setLoginItemSettings({
    openAtLogin: true,
    path: wscript,
    args: [`"${vbsPath}"`],
    name: APP_NAME,
  });
}
