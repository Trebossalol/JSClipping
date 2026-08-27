import {
  configuredObsScene,
  getObsProgramScene,
  listObsScenes,
  setObsProgramScene,
} from "../../shared/obs.js";
import type { ObsScenesResult } from "../../shared/ipc.js";
import { getConfig } from "../session.js";
import { restartReplayBufferBestEffort } from "./replay.js";
import { sendObsStatus } from "./status.js";
import { obsState } from "./state.js";

export async function refreshProgramScene(): Promise<void> {
  if (!obsState.connected) {
    obsState.currentProgramScene = null;
    return;
  }
  try {
    obsState.currentProgramScene = await getObsProgramScene(obsState.socket);
  } catch {
    obsState.currentProgramScene = null;
  }
}

export async function applyClipScene(): Promise<
  | { ok: true; switched: boolean }
  | { ok: false; switched: false; error: string }
> {
  const scene = configuredObsScene(getConfig().OBS_SCENE);
  if (!scene || !obsState.connected) return { ok: true, switched: false };
  try {
    const current = await getObsProgramScene(obsState.socket);
    if (current === scene) {
      obsState.currentProgramScene = current;
      return { ok: true, switched: false };
    }
    await setObsProgramScene(obsState.socket, scene);
    obsState.currentProgramScene = scene;
    sendObsStatus();
    return { ok: true, switched: true };
  } catch {
    return {
      ok: false,
      switched: false,
      error: `Die OBS-Szene „${scene}“ wurde nicht gefunden. Wähle sie unter OBS Verbindung.`,
    };
  }
}

export async function prepareObsClipScene(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const result = await applyClipScene();
  if (!result.ok) return result;
  if (result.switched && obsState.replayBufferActive === true) {
    await restartReplayBufferBestEffort();
  }
  return { ok: true };
}

export async function fetchObsScenes(): Promise<ObsScenesResult> {
  if (!obsState.connected) {
    return { ok: true, scenes: [], currentScene: null };
  }
  try {
    const listed = await listObsScenes(obsState.socket);
    obsState.currentProgramScene = listed.current;
    return {
      ok: true,
      scenes: listed.names,
      currentScene: listed.current,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
