import { IpcChannels, type ObsStatus } from "../../shared/ipc.js";
import { mainAndQuickActionWindows } from "../windows/broadcast.js";
import { obsState } from "./state.js";

export function currentObsStatus(): ObsStatus {
  return {
    connected: obsState.connected,
    running: obsState.connected || obsState.processRunning,
    error: obsState.error,
    replayBufferActive: obsState.connected ? obsState.replayBufferActive : false,
    replayMaxSeconds: obsState.connected ? obsState.replayMaxSeconds : null,
    currentScene: obsState.connected ? obsState.currentProgramScene : null,
  };
}

export function sendObsStatus(): void {
  const status = currentObsStatus();
  for (const win of mainAndQuickActionWindows()) {
    win.webContents.send(IpcChannels.obsStatusChanged, status);
  }
}

export function resetObsRuntimeState(): void {
  obsState.connected = false;
  obsState.replayBufferActive = false;
  obsState.replayMaxSeconds = null;
  obsState.currentProgramScene = null;
}
