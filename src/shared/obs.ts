import type { OBSWebSocket } from "obs-websocket-js";

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

/** OBS "Maximum Replay Time" (`RecRBTime`) in seconds. */
export async function getObsReplayMaxSeconds(
  obs: OBSWebSocket,
): Promise<number | null> {
  const modeRes = await obs.call("GetProfileParameter", {
    parameterCategory: "Output",
    parameterName: "Mode",
  });
  const category =
    modeRes.parameterValue === "Advanced" ? "AdvOut" : "SimpleOutput";
  const timeRes = await obs.call("GetProfileParameter", {
    parameterCategory: category,
    parameterName: "RecRBTime",
  });
  return (
    parseObsProfileSeconds(timeRes.parameterValue) ??
    parseObsProfileSeconds(timeRes.defaultParameterValue)
  );
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
