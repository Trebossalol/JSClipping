import { app, Notification, shell } from "electron";
import { APP_GITHUB_REPO, APP_ID, APP_NAME } from "../shared/app.config.js";
import {
  IpcChannels,
  type AppUpdateInfo,
  type CheckForUpdatesResult,
} from "../shared/ipc.js";
import { getConfig } from "./session.js";
import {
  getMainWindow,
  sendToMainWindow,
  windowCanShowToast,
} from "./windows/index.js";

const FETCH_TIMEOUT_MS = 8000;
const RENDERER_READY_DELAY_MS = 500;

export function isNewerVersion(latest: string, current: string): boolean {
  const a = versionParts(latest);
  const b = versionParts(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

function versionParts(raw: string): number[] {
  const stripped = raw.trim().replace(/^v/i, "");
  if (!stripped) return [0];
  return stripped.split(".").map((part) => {
    const n = Number.parseInt(part, 10);
    return Number.isFinite(n) ? n : 0;
  });
}

function releaseUrl(htmlUrl: string): string {
  try {
    const parsed = new URL(htmlUrl);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
  } catch {
    // Fall through to the releases index.
  }
  return `https://github.com/${APP_GITHUB_REPO}/releases`;
}

export async function checkForAppUpdate(): Promise<CheckForUpdatesResult> {
  const current = app.getVersion();
  try {
    const response = await fetch(
      `https://api.github.com/repos/${APP_GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": `${APP_ID}/${current}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );
    if (response.status === 404) {
      return { ok: false, error: "Kein GitHub-Release gefunden." };
    }
    if (!response.ok) {
      return { ok: false, error: "Update-Prüfung fehlgeschlagen." };
    }
    const body = (await response.json()) as {
      tag_name?: unknown;
      html_url?: unknown;
      draft?: unknown;
      prerelease?: unknown;
    };
    if (body.draft === true || body.prerelease === true) {
      return { ok: true, update: null };
    }
    if (typeof body.tag_name !== "string" || !body.tag_name.trim()) {
      return { ok: false, error: "Update-Prüfung fehlgeschlagen." };
    }
    const version = body.tag_name.trim().replace(/^v/i, "");
    if (!isNewerVersion(version, current)) {
      return { ok: true, update: null };
    }
    const url =
      typeof body.html_url === "string"
        ? releaseUrl(body.html_url)
        : `https://github.com/${APP_GITHUB_REPO}/releases`;
    return { ok: true, update: { version, url } };
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError")
    ) {
      return { ok: false, error: "Zeitüberschreitung bei der Update-Prüfung." };
    }
    return { ok: false, error: "Keine Verbindung zu GitHub." };
  }
}

function announceUpdate(update: AppUpdateInfo): void {
  if (windowCanShowToast()) {
    sendToMainWindow(IpcChannels.updateAvailable, update);
    return;
  }
  const notification = new Notification({
    title: APP_NAME,
    body: `Version ${update.version} ist verfügbar.`,
  });
  notification.on("click", () => {
    void shell.openExternal(update.url);
  });
  notification.show();
}

async function notifyIfUpdateAvailable(): Promise<void> {
  if (!getConfig().CHECK_FOR_UPDATES) return;
  const result = await checkForAppUpdate();
  if (!result.ok || !result.update) return;
  announceUpdate(result.update);
}

/** Fire-and-forget boot check after the main window can receive toasts. */
export function scheduleUpdateCheck(): void {
  if (!getConfig().CHECK_FOR_UPDATES) return;

  const win = getMainWindow();
  const run = (): void => {
    void notifyIfUpdateAvailable();
  };

  if (!win || win.isDestroyed()) {
    run();
    return;
  }

  let done = false;
  const fire = (): void => {
    if (done) return;
    done = true;
    win.webContents.removeListener("did-finish-load", fire);
    setTimeout(run, RENDERER_READY_DELAY_MS);
  };

  win.webContents.once("did-finish-load", fire);
  if (!win.webContents.isLoading() && win.webContents.getURL()) {
    fire();
  }
}
