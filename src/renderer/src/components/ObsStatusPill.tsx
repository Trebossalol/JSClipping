import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import type { ObsStatus } from "@shared/ipc";
import {
  ChevronDownIcon,
  MonitorPlayIcon,
  PlugIcon,
  PowerOffIcon,
  UnplugIcon,
} from "lucide-react";
import {
  startObsWithAutostart,
  stopObsProcess,
} from "./ClipActions";

interface ObsStatusPillProps {
  status: ObsStatus | null;
}

export function ObsStatusPill({ status }: ObsStatusPillProps) {
  const [busy, setBusy] = useState(false);
  const connected = status?.connected === true;
  const running = status?.running === true || connected;
  const replayOff = connected && status.replayBufferActive === false;

  async function onStartObs(): Promise<void> {
    setBusy(true);
    try {
      await startObsWithAutostart();
    } finally {
      setBusy(false);
    }
  }

  async function onStopObs(): Promise<void> {
    setBusy(true);
    try {
      await stopObsProcess();
    } finally {
      setBusy(false);
    }
  }

  const connecting = status == null;
  const label = connecting
    ? "Verbinden…"
    : connected
      ? replayOff
        ? "Puffer aus"
        : "OBS verbunden"
      : "OBS getrennt";
  const title = connecting
    ? undefined
    : connected
      ? undefined
      : (status.error ?? "Nicht verbunden");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={connected || connecting ? "outline" : "destructive"}
          title={title}
          aria-label="OBS-Status"
        >
          {connecting ? (
            <Spinner className="size-3.5" />
          ) : connected ? (
            <PlugIcon data-icon="inline-start" />
          ) : (
            <UnplugIcon data-icon="inline-start" />
          )}
          {label}
          <ChevronDownIcon data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        {running ? (
          <DropdownMenuItem
            variant="destructive"
            disabled={busy}
            onClick={() => void onStopObs()}
          >
            {busy ? <Spinner className="size-4" /> : null}
            OBS beenden
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            disabled={busy || connecting}
            onClick={() => void onStartObs()}
          >
            {busy ? <Spinner className="size-4" /> : null}
            OBS starten
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
