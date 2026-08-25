import type { OBSWebSocket } from "obs-websocket-js";

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
