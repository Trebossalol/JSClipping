import { isObsProcessRunning, killObsProcess } from "./process.js";
import { stopObsReplayBufferBestEffort } from "./replay.js";
import { resetObsRuntimeState, sendObsStatus } from "./status.js";
import { obsState } from "./state.js";

/**
 * Stop replay, drop the WebSocket, then quit OBS.
 * Used by the Settings stop button — not the same as a silent disconnect.
 */
export async function stopObsClipMode(): Promise<{
  ok: boolean;
  error?: string;
}> {
  await stopObsReplayBufferBestEffort();
  obsState.intentionalDisconnect = true;
  obsState.connectGen += 1;
  obsState.connecting = false;
  if (obsState.reconnectTimer) {
    clearTimeout(obsState.reconnectTimer);
    obsState.reconnectTimer = null;
  }
  try {
    await obsState.socket.disconnect();
  } catch {
    // ignore
  }
  resetObsRuntimeState();
  sendObsStatus();
  try {
    const stopped = await killObsProcess();
    obsState.processRunning = !stopped;
    sendObsStatus();
    if (!stopped) {
      return {
        ok: false,
        error: "OBS konnte nicht beendet werden.",
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    obsState.processRunning = await isObsProcessRunning();
    sendObsStatus();
    return { ok: false, error: message };
  }
  sendObsStatus();
  return { ok: true };
}
