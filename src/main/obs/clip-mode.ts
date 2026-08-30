import { dirname, join } from "node:path";
import { configuredObsScene } from "../../shared/obs.js";
import {
  getAutostartBatPath,
  getRepoRoot,
  isPackagedApp,
  resolveObsExecutable,
} from "../../shared/paths.js";
import { getConfig } from "../session.js";
import {
  markObsLaunchRequested,
  requestObsReconnect,
  waitForObsConnected,
} from "./connection.js";
import {
  clearObsShutdownSentinel,
  isObsProcessRunning,
  OBS_LAUNCH_ARGS,
  refreshObsProcessRunning,
  spawnDetached,
} from "./process.js";
import {
  applyConfiguredReplayMaxSeconds,
  ensureReplayBufferStarted,
  refreshReplayMaxSeconds,
} from "./replay.js";
import { prepareObsClipScene } from "./scenes.js";
import { sendObsStatus } from "./status.js";
import { obsState } from "./state.js";

function obsLaunchArgs(): string[] {
  const args = [...OBS_LAUNCH_ARGS];
  const scene = configuredObsScene(getConfig().OBS_SCENE);
  if (scene) args.push("--scene", scene);
  return args;
}

export async function startObsClipMode(): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (await isObsProcessRunning()) {
    obsState.processRunning = true;
    sendObsStatus();
    requestObsReconnect();
    const connected = await waitForObsConnected(12_000);
    if (connected) {
      const scene = await prepareObsClipScene();
      if (!scene.ok) return scene;
      await applyConfiguredReplayMaxSeconds();
      await ensureReplayBufferStarted();
      return { ok: true };
    }
    return {
      ok: false,
      error:
        obsState.error ??
        "OBS läuft bereits, aber die WebSocket-Verbindung ist fehlgeschlagen. Prüfe URL und Passwort unter OBS.",
    };
  }

  const configuredExe = getConfig().OBS_EXE_PATH;
  const exe = resolveObsExecutable(configuredExe);
  if (exe) {
    try {
      clearObsShutdownSentinel();
      await spawnDetached(exe, obsLaunchArgs(), dirname(exe));
      markObsLaunchRequested();
      const connected = await waitForObsConnected(12_000);
      if (connected) {
        const scene = await prepareObsClipScene();
        if (!scene.ok) return scene;
        await applyConfiguredReplayMaxSeconds();
        await ensureReplayBufferStarted();
      }
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }

  if (!configuredExe.trim() && !isPackagedApp()) {
    const bat = getAutostartBatPath();
    if (bat) {
      try {
        await spawnDetached(
          "cmd.exe",
          ["/d", "/c", bat],
          join(getRepoRoot(), "scripts"),
          true,
        );
        markObsLaunchRequested();
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
      }
    }
  }

  return {
    ok: false,
    error:
      configuredExe.trim()
        ? `OBS wurde unter „${configuredExe.trim()}“ nicht gefunden. Prüfe den Pfad unter OBS.`
        : "OBS Studio wurde nicht gefunden. Wähle die Programmdatei unter OBS oder installiere OBS unter dem Standardpfad.",
  };
}

export function startObsProcessPoll(): void {
  if (obsState.processPoll) return;
  obsState.processPoll = setInterval(() => {
    void refreshObsProcessRunning();
    if (!obsState.connected) return;
    void refreshReplayMaxSeconds().then((changed) => {
      if (changed) sendObsStatus();
    });
  }, 2000);
}

export function stopObsProcessPoll(): void {
  if (!obsState.processPoll) return;
  clearInterval(obsState.processPoll);
  obsState.processPoll = null;
}
