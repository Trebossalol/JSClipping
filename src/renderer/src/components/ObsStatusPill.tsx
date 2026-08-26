import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { formatDuration } from "@/format";
import type { ObsStatus } from "@shared/ipc";
import { ChevronDownIcon, PlugIcon, SettingsIcon, UnplugIcon } from "lucide-react";
import { startObsWithAutostart, stopObsProcess } from "./ClipActions";
import { useTopLoader } from "./TopLoadingBar";

interface ObsStatusPillProps {
  status: ObsStatus | null;
  onGoToSettings: () => void;
}

export function ObsStatusPill({ status, onGoToSettings }: ObsStatusPillProps) {
  const loader = useTopLoader();
  const [busy, setBusy] = useState(false);
  const connected = status?.connected === true;
  const running = status?.running === true || connected;
  const replayOff = connected && status.replayBufferActive === false;

  async function onStartObs(): Promise<void> {
    setBusy(true);
    try {
      await loader.wrap(() => startObsWithAutostart());
    } finally {
      setBusy(false);
    }
  }

  async function onStopObs(): Promise<void> {
    setBusy(true);
    try {
      await loader.wrap(() => stopObsProcess());
    } finally {
      setBusy(false);
    }
  }

  const connecting = status == null;
  const replayMaxLabel =
    connected && status.replayMaxSeconds != null
      ? formatDuration(status.replayMaxSeconds)
      : "";
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
      : running
        ? (status.error ?? "Nicht verbunden — klicken zum Verbinden")
        : (status.error ?? "Nicht verbunden — klicken zum Starten");
  const variant = connected || connecting ? "outline" : "destructive";

  return (
    <ButtonGroup>
      <Button
        type="button"
        size="sm"
        variant={variant}
        title={title}
        aria-label="OBS-Status"
        disabled={busy || connecting}
        onClick={() => {
          if (!connected) void onStartObs();
        }}
      >
        {connecting ? (
          <Spinner />
        ) : connected ? (
          <PlugIcon data-icon="inline-start" />
        ) : (
          <UnplugIcon data-icon="inline-start" />
        )}
        {label}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant={variant}
            className="px-1.5"
            disabled={busy || connecting}
            aria-label="OBS-Aktionen"
          >
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-60">
          {replayMaxLabel ? (
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                Puffer max. {replayMaxLabel}
                <span className="mt-0.5 block font-normal">
                  Maximale Wiederholungszeit in OBS
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </DropdownMenuGroup>
          ) : null}
          {!connected && status?.error ? (
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                {status.error}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </DropdownMenuGroup>
          ) : null}
          <DropdownMenuGroup>
            {!connected ? (
              <DropdownMenuItem
                disabled={busy}
                onSelect={() => void onStartObs()}
              >
                {busy ? 
                <Spinner /> : <PlugIcon data-icon="inline-start" />}
                {running ? "Verbinden" : "OBS starten"}
              </DropdownMenuItem>
            ) : null}
            {running ? (
              <DropdownMenuItem
                variant="destructive"
                disabled={busy}
                onSelect={() => void onStopObs()}
              >
                {busy ? <Spinner /> : null}
                OBS beenden
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onGoToSettings}>
            <SettingsIcon />
            Verbindungseinstellungen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}
