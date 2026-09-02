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
import {
  ChevronDownIcon,
  PlugIcon,
  SettingsIcon,
  UnplugIcon,
  XCircleIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { startObsWithAutostart, stopObsProcess } from "@/components/ClipActions";
import { useTopLoader } from "@/components/TopLoadingBar";

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
        : replayMaxLabel
          ? `OBS · ${replayMaxLabel}`
          : "OBS verbunden"
      : "OBS getrennt";
  const title = connecting
    ? undefined
    : connected
      ? replayOff
        ? "Wiederholungspuffer ist aus"
        : undefined
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
        className={cn(
          "glass border-white/10",
          connected && !replayOff && "text-foreground",
        )}
        title={title}
        aria-label="OBS-Status"
        disabled={busy || connecting}
        onClick={() => {
          if (!connected) void onStartObs();
        }}
      >
        {connecting ? (
          <Spinner />
        ) : (
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              connected && !replayOff && "bg-primary pulse-dot",
              connected && replayOff && "bg-amber-400",
              !connected && "bg-destructive",
            )}
            aria-hidden
          />
        )}
        {connected ? (
          <PlugIcon data-icon="inline-start" className="opacity-70" />
        ) : connecting ? null : (
          <UnplugIcon data-icon="inline-start" className="opacity-70" />
        )}
        {label}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant={variant}
            className="glass border-white/10 px-1.5"
            disabled={busy || connecting}
            aria-label="OBS-Aktionen"
          >
            <ChevronDownIcon className="opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-60">
          {!connected && status?.error ? (
            <DropdownMenuGroup>
              <DropdownMenuLabel>{status.error}</DropdownMenuLabel>
              <DropdownMenuSeparator />
            </DropdownMenuGroup>
          ) : null}
          <DropdownMenuGroup>
            {!connected ? (
              <DropdownMenuItem
                disabled={busy}
                onSelect={() => void onStartObs()}
              >
                {busy ? <Spinner /> : <PlugIcon data-icon="inline-start" />}
                {running ? "Verbinden" : "OBS starten"}
              </DropdownMenuItem>
            ) : null}
            {running ? (
              <DropdownMenuItem
                variant="destructive"
                disabled={busy}
                onSelect={() => void onStopObs()}
              >
                {busy ? <Spinner /> : <XCircleIcon />}
                OBS beenden
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onGoToSettings}>
            <SettingsIcon className="opacity-70" />
            OBS-Einstellungen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}
