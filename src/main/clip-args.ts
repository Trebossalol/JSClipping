import { parseClipSecondsArg } from "../shared/paths.js";

/**
 * `--clip 30` from the command line (or a second instance).
 * The main window stays hidden until this is flushed after OBS is ready.
 */
let pendingClipSeconds: number | null = parseClipSecondsArg(process.argv);
let appReadyForClip = false;

export function getPendingClipSeconds(): number | null {
  return pendingClipSeconds;
}

export function setPendingClipSeconds(seconds: number | null): void {
  pendingClipSeconds = seconds;
}

export function isAppReadyForClip(): boolean {
  return appReadyForClip;
}

export function markAppReadyForClip(): void {
  appReadyForClip = true;
}

export function takePendingClipSeconds(): number | null {
  if (pendingClipSeconds == null) return null;
  const seconds = pendingClipSeconds;
  pendingClipSeconds = null;
  return seconds;
}
