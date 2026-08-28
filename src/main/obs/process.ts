import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { sleep } from "../util.js";
import { sendObsStatus } from "./status.js";
import { obsState } from "./state.js";

const execFileAsync = promisify(execFile);

export const OBS_IMAGE = "obs64.exe";

export const OBS_LAUNCH_ARGS = [
  "--startreplaybuffer",
  "--minimize-to-tray",
  // Ignored on OBS 32+, still prevents the safe-mode prompt on older builds.
  "--disable-shutdown-check",
];

export async function isObsProcessRunning(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      "tasklist",
      ["/FI", `IMAGENAME eq ${OBS_IMAGE}`, "/FO", "CSV", "/NH"],
      { windowsHide: true, timeout: 5000 },
    );
    return stdout.toLowerCase().includes(OBS_IMAGE.toLowerCase());
  } catch {
    return false;
  }
}

export async function refreshObsProcessRunning(): Promise<void> {
  const next = await isObsProcessRunning();
  if (next === obsState.processRunning) return;
  obsState.processRunning = next;
  sendObsStatus();
}

async function waitUntilObsExits(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isObsProcessRunning())) return true;
    await sleep(200);
  }
  return !(await isObsProcessRunning());
}

async function requestObsClose(): Promise<void> {
  try {
    await execFileAsync("taskkill", ["/IM", OBS_IMAGE], {
      windowsHide: true,
      timeout: 4000,
    });
  } catch {
    // Process may already be gone, or OBS hid to tray instead of quitting.
  }
}

/**
 * OBS with --minimize-to-tray treats the first WM_CLOSE as "hide".
 * A second close (window no longer visible) actually quits and clears the
 * unclean-shutdown sentinel. Force-kill only as a last resort.
 */
export async function killObsProcess(): Promise<boolean> {
  await requestObsClose();
  if (await waitUntilObsExits(1500)) return true;
  await requestObsClose();
  if (await waitUntilObsExits(6000)) return true;
  try {
    await execFileAsync("taskkill", ["/IM", OBS_IMAGE, "/T", "/F"], {
      windowsHide: true,
      timeout: 8000,
    });
  } catch {
    // Process may already be gone.
  }
  return waitUntilObsExits(4000);
}

/** OBS shows the safe-mode prompt when this leftover exists after a crash/kill. */
export function clearObsShutdownSentinel(): void {
  const appData = process.env.APPDATA;
  if (!appData) return;
  try {
    fs.rmSync(join(appData, "obs-studio", ".sentinel"), {
      recursive: true,
      force: true,
    });
  } catch {
    // ignore
  }
}

export function spawnDetached(
  command: string,
  args: string[],
  cwd: string,
  windowsHide = false,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(command, args, {
      cwd,
      detached: true,
      stdio: "ignore",
      windowsHide,
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
    child.once("spawn", () => {
      if (settled) return;
      settled = true;
      child.unref();
      resolve();
    });
  });
}
