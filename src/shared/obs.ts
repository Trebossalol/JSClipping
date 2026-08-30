import type { OBSWebSocket } from "obs-websocket-js";
import {
  MAX_OBS_REPLAY_SECONDS,
  MIN_OBS_REPLAY_SECONDS,
} from "./app.config.js";

/**
 * `localhost` often resolves to IPv6 `::1` on Windows while OBS listens on
 * IPv4 only — try `127.0.0.1` first, then the original URL.
 */
export function obsWebSocketUrls(url: string): string[] {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.toLowerCase() === "localhost") {
      const ipv4 = new URL(url);
      ipv4.hostname = "127.0.0.1";
      const rewritten = ipv4.toString();
      return rewritten === url ? [url] : [rewritten, url];
    }
  } catch {
    // keep the original string
  }
  return [url];
}

export function parseObsProfileSeconds(
  value: string | undefined | null,
): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function configuredReplaySeconds(
  value: number | undefined | null,
): number | null {
  if (value == null || !Number.isInteger(value)) return null;
  if (value < MIN_OBS_REPLAY_SECONDS || value > MAX_OBS_REPLAY_SECONDS) {
    return null;
  }
  return value;
}

async function obsReplayBufferCategory(
  obs: OBSWebSocket,
): Promise<"AdvOut" | "SimpleOutput"> {
  const modeRes = await obs.call("GetProfileParameter", {
    parameterCategory: "Output",
    parameterName: "Mode",
  });
  return modeRes.parameterValue === "Advanced" ? "AdvOut" : "SimpleOutput";
}

/** OBS "Maximum Replay Time" (`RecRBTime`) in seconds. */
export async function getObsReplayMaxSeconds(
  obs: OBSWebSocket,
): Promise<number | null> {
  const category = await obsReplayBufferCategory(obs);
  const timeRes = await obs.call("GetProfileParameter", {
    parameterCategory: category,
    parameterName: "RecRBTime",
  });
  return (
    parseObsProfileSeconds(timeRes.parameterValue) ??
    parseObsProfileSeconds(timeRes.defaultParameterValue)
  );
}

/** Writes Maximum Replay Time to both output modes so a later mode switch stays in sync. */
export async function setObsReplayMaxSeconds(
  obs: OBSWebSocket,
  seconds: number,
): Promise<void> {
  const value = String(seconds);
  for (const category of ["SimpleOutput", "AdvOut"] as const) {
    await obs.call("SetProfileParameter", {
      parameterCategory: category,
      parameterName: "RecRBTime",
      parameterValue: value,
    });
  }
}

export function configuredObsScene(scene: string | undefined | null): string | null {
  const trimmed = scene?.trim();
  return trimmed ? trimmed : null;
}

export async function getObsProgramScene(
  obs: OBSWebSocket,
): Promise<string | null> {
  const res = await obs.call("GetCurrentProgramScene");
  return res.currentProgramSceneName ?? null;
}

export async function listObsScenes(obs: OBSWebSocket): Promise<{
  names: string[];
  current: string | null;
}> {
  const res = await obs.call("GetSceneList");
  const names = res.scenes
    .map((scene) => scene.sceneName)
    .filter((name): name is string => typeof name === "string" && name.length > 0);
  return {
    names,
    current: res.currentProgramSceneName ?? null,
  };
}

export async function setObsProgramScene(
  obs: OBSWebSocket,
  sceneName: string,
): Promise<void> {
  await obs.call("SetCurrentProgramScene", { sceneName });
}
