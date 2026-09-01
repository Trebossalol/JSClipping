import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { formatDuration } from "@/format";
import { APP_NAME } from "@shared/app.config";
import type { ObsStatus } from "@shared/ipc";
import {
  AlertCircleIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { toast } from "sonner";

export function clipPresetsFromSeconds(values: number[]): Array<{
  seconds: number;
  label: string;
  hint: string;
}> {
  return values.map((seconds) => ({
    seconds,
    label: formatDuration(seconds),
    hint: `Letzte ${formatDuration(seconds)}`,
  }));
}

export function getClipAvailability(
  obsStatus: ObsStatus | null,
  busy: boolean,
  clipScene?: string | null,
): {
  connected: boolean;
  replayOff: boolean;
  sceneMismatch: boolean;
  canClip: boolean;
} {
  const connected = obsStatus?.connected === true;
  const replayOff = connected && obsStatus.replayBufferActive === false;
  const scene = clipScene?.trim() || null;
  const sceneMismatch =
    connected &&
    scene != null &&
    obsStatus.currentScene != null &&
    obsStatus.currentScene !== scene;
  const canClip =
    connected &&
    obsStatus.replayBufferActive !== false &&
    !busy &&
    !sceneMismatch;
  return { connected, replayOff, sceneMismatch, canClip };
}

export async function startObsWithAutostart(): Promise<void> {
  const result = await window.api.startObs();
  if (!result.ok) {
    toast.error(result.error ?? "OBS konnte nicht gestartet werden.");
    return;
  }
  toast.success("OBS wird gestartet…");
}

export async function stopObsProcess(): Promise<void> {
  const result = await window.api.stopObs();
  if (!result.ok) {
    toast.error(result.error ?? "OBS konnte nicht beendet werden.");
    return;
  }
  toast.success("OBS wird beendet…");
}

const compactAlert =
  "items-center py-1.5 *:[svg]:row-span-1 *:[svg]:translate-y-0 *:[svg]:opacity-70";

interface ClipActionsProps {
  busy: boolean;
  obsStatus: ObsStatus | null;
  clipScene?: string | null;
  message: { text: string; kind: "ok" | "err" } | null;
}

export function ClipActions({
  busy,
  obsStatus,
  clipScene,
  message,
}: ClipActionsProps) {
  const { replayOff, sceneMismatch } = getClipAvailability(
    obsStatus,
    busy,
    clipScene,
  );

  if (busy) {
    return (
      <Alert className={compactAlert}>
        <Spinner />
        <AlertTitle>Clip wird gespeichert…</AlertTitle>
      </Alert>
    );
  }

  if (replayOff) {
    return (
      <Alert variant="warning" className={compactAlert}>
        <TriangleAlertIcon />
        <AlertTitle>Wiederholungspuffer ist aus</AlertTitle>
        <AlertDescription>
          Starte ihn in OBS oder nutze autostart.bat.
        </AlertDescription>
      </Alert>
    );
  }

  if (sceneMismatch) {
    const wanted = clipScene?.trim() ?? "";
    const current = obsStatus?.currentScene ?? "";
    return (
      <Alert variant="warning" className={compactAlert}>
        <TriangleAlertIcon />
        <AlertTitle>Falsche OBS-Szene</AlertTitle>
        <AlertDescription>
          Clips nutzen „{wanted}“, OBS ist auf „{current}“. Starte OBS über{" "}
          {APP_NAME}, damit der Puffer die richtige Szene aufzeichnet.
        </AlertDescription>
      </Alert>
    );
  }

  if (message?.kind === "err") {
    return (
      <Alert variant="destructive" className={compactAlert}>
        <AlertCircleIcon />
        <AlertTitle>Fehler</AlertTitle>
        <AlertDescription>{message.text}</AlertDescription>
      </Alert>
    );
  }

  return null;
}
