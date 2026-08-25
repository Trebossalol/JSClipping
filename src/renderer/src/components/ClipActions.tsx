import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { formatDuration } from "@/format";
import { APP_NAME } from "@shared/app.config";
import type { ObsStatus } from "@shared/ipc";
import {
  AlertCircleIcon,
  CircleCheckIcon,
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
): { connected: boolean; replayOff: boolean; canClip: boolean } {
  const connected = obsStatus?.connected === true;
  const replayOff = connected && obsStatus.replayBufferActive === false;
  const canClip = connected && obsStatus.replayBufferActive !== false && !busy;
  return { connected, replayOff, canClip };
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

interface ClipActionsProps {
  busy: boolean;
  obsStatus: ObsStatus | null;
  message: { text: string; kind: "ok" | "err" } | null;
}

export function ClipActions({ busy, obsStatus, message }: ClipActionsProps) {
  const { replayOff } = getClipAvailability(obsStatus, busy);

  if (busy) {
    return (
      <Alert>
        <Spinner />
        <AlertTitle>Wird verarbeitet</AlertTitle>
        <AlertDescription>Clip wird gespeichert…</AlertDescription>
      </Alert>
    );
  }

  if (replayOff) {
    return (
      <Alert>
        <TriangleAlertIcon />
        <AlertTitle>Wiederholungspuffer ist aus</AlertTitle>
        <AlertDescription>
          {APP_NAME} speichert nur den Puffer — starte ihn in OBS oder nutze
          autostart.bat.
        </AlertDescription>
      </Alert>
    );
  }

  if (message) {
    return (
      <Alert variant={message.kind === "err" ? "destructive" : "default"}>
        {message.kind === "err" ? <AlertCircleIcon /> : <CircleCheckIcon />}
        <AlertTitle>
          {message.kind === "err" ? "Fehler" : "Clip gespeichert"}
        </AlertTitle>
        <AlertDescription>{message.text}</AlertDescription>
      </Alert>
    );
  }

  return null;
}
