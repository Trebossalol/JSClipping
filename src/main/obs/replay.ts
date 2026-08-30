import {
  configuredReplaySeconds,
  getObsReplayMaxSeconds,
  setObsReplayMaxSeconds,
} from "../../shared/obs.js";
import { getConfig } from "../session.js";
import { sendObsStatus } from "./status.js";
import { obsState } from "./state.js";

export async function refreshReplayBuffer(): Promise<void> {
  if (!obsState.connected) {
    obsState.replayBufferActive = false;
    return;
  }
  try {
    const status = await obsState.socket.call("GetReplayBufferStatus");
    obsState.replayBufferActive = Boolean(status.outputActive);
  } catch {
    obsState.replayBufferActive = null;
  }
}

export async function refreshReplayMaxSeconds(): Promise<boolean> {
  if (!obsState.connected) {
    const changed = obsState.replayMaxSeconds !== null;
    obsState.replayMaxSeconds = null;
    return changed;
  }
  try {
    const next = await getObsReplayMaxSeconds(obsState.socket);
    const changed = obsState.replayMaxSeconds !== next;
    obsState.replayMaxSeconds = next;
    return changed;
  } catch {
    return false;
  }
}

export async function ensureReplayBufferStarted(): Promise<void> {
  if (!obsState.connected) return;
  await refreshReplayBuffer();
  if (obsState.replayBufferActive === true) return;
  try {
    await obsState.socket.call("StartReplayBuffer");
    obsState.replayBufferActive = true;
    sendObsStatus();
  } catch {
    // Replay buffer may be disabled in OBS settings.
  }
}

export async function stopObsReplayBufferBestEffort(): Promise<void> {
  if (!obsState.connected) return;
  try {
    await obsState.socket.call("StopReplayBuffer");
  } catch {
    // Buffer may already be off.
  }
}

export async function restartReplayBufferBestEffort(): Promise<void> {
  if (!obsState.connected) return;
  try {
    await obsState.socket.call("StopReplayBuffer");
    obsState.replayBufferActive = false;
  } catch {
    // Buffer may already be off.
  }
  await ensureReplayBufferStarted();
}

/** Push Easy Clip's replay duration to OBS and restart the buffer if it changed. */
export async function applyConfiguredReplayMaxSeconds(): Promise<void> {
  const wanted = configuredReplaySeconds(getConfig().OBS_REPLAY_SECONDS);
  if (!wanted || !obsState.connected) return;
  try {
    const current = await getObsReplayMaxSeconds(obsState.socket);
    if (current === wanted) {
      obsState.replayMaxSeconds = current;
      return;
    }
    await setObsReplayMaxSeconds(obsState.socket, wanted);
    await restartReplayBufferBestEffort();
    const next = await getObsReplayMaxSeconds(obsState.socket);
    obsState.replayMaxSeconds = next ?? wanted;
    sendObsStatus();
  } catch {
    // Profile writes can fail if OBS settings are locked.
  }
}
