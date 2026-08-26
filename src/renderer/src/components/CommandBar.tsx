import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { formatDuration } from "@/format";
import { formatHotkey } from "@shared/hotkeys";
import type { ClipPreset, ObsStatus } from "@shared/ipc";
import { ClockIcon } from "lucide-react";
import {
  clipPresetsFromSeconds,
  getClipAvailability,
} from "./ClipActions";
import { ObsStatusPill } from "./ObsStatusPill";

interface CommandBarProps {
  obsStatus: ObsStatus | null;
  busy: boolean;
  lastSeconds: number | null;
  clipPresets: ClipPreset[];
  onCreate: (seconds: number) => void;
  onGoToObsSettings: () => void;
}

export function CommandBar({
  obsStatus,
  busy,
  lastSeconds,
  clipPresets,
  onCreate,
  onGoToObsSettings,
}: CommandBarProps) {
  const presets = clipPresetsFromSeconds(
    clipPresets.map((preset) => preset.seconds),
  );
  const hotkeys = new Map(
    clipPresets.map((preset) => [preset.seconds, preset.hotkey]),
  );
  const { connected, replayOff, canClip } = getClipAvailability(
    obsStatus,
    busy,
  );
  const disabledReason = replayOff
    ? "Wiederholungspuffer ist aus"
    : busy
      ? "Clip wird gespeichert…"
      : connected
        ? undefined
        : "OBS ist nicht verbunden";

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-4" />
      <ObsStatusPill status={obsStatus} onGoToSettings={onGoToObsSettings} />
      {obsStatus && obsStatus.connected === true ? (
        <ButtonGroup className="flex-wrap">
          {presets.map(({ seconds, label, hint }) => {
            const replayMax = obsStatus.replayMaxSeconds ?? null;
            const overBuffer = replayMax != null && seconds > replayMax;
            const active = lastSeconds === seconds;
            const hotkey = hotkeys.get(seconds);
            const hotkeyLabel = hotkey ? formatHotkey(hotkey) : null;
            return (
              <Button
                key={seconds}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                disabled={!canClip || overBuffer}
                title={
                  overBuffer && replayMax != null
                    ? `Länger als der OBS-Puffer (${formatDuration(replayMax)})`
                    : [disabledReason ?? hint, hotkeyLabel]
                        .filter(Boolean)
                        .join(" · ")
                }
                onClick={() => onCreate(seconds)}
              >
                <ClockIcon data-icon="inline-start" />
                {label}
                {hotkeyLabel ? (
                  <span className={active ? "opacity-80" : "text-muted-foreground"}>
                    {hotkeyLabel}
                  </span>
                ) : null}
              </Button>
            );
          })}
        </ButtonGroup>
      ) : null}
    </header>
  );
}
