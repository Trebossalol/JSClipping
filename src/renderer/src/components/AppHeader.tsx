import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import type { ObsStatus } from "@shared/ipc";
import {
  ClockIcon,
  FilePenIcon,
  HardDriveIcon,
  LibraryIcon,
  ScissorsIcon,
  SettingsIcon,
} from "lucide-react";
import {
  clipPresetsFromSeconds,
  getClipAvailability,
} from "./ClipActions";
import { ObsStatusPill } from "./ObsStatusPill";

export type AppView = "library" | "storage" | "settings";

interface AppHeaderProps {
  view: AppView;
  onViewChange: (view: AppView) => void;
  obsStatus: ObsStatus | null;
  untitledCount: number;
  onUntitled: () => void;
  busy: boolean;
  lastSeconds: number | null;
  clipPresets: number[];
  onCreate: (seconds: number) => void;
}

export function AppHeader({
  view,
  onViewChange,
  obsStatus,
  untitledCount,
  onUntitled,
  busy,
  lastSeconds,
  clipPresets,
  onCreate,
}: AppHeaderProps) {
  const presets = clipPresetsFromSeconds(clipPresets);
  const { connected, replayOff, canClip } = getClipAvailability(
    obsStatus,
    busy,
  );
  const disabledReason = replayOff
    ? "Wiederholungspuffer ist aus"
    : busy
      ? "Clip wird gespeichert…"
      : undefined;

  return (
    <header className="border-b bg-card px-5 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <ScissorsIcon className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg leading-6 font-semibold tracking-tight">
              JSClipping
            </h1>
            <p className="text-xs text-muted-foreground">
              Begleit-App für den OBS-Wiederholungspuffer
            </p>
          </div>
        </div>
        <ButtonGroup>
          <Button
            type="button"
            size="sm"
            variant={view === "library" ? "default" : "outline"}
            onClick={() => onViewChange("library")}
          >
            <LibraryIcon data-icon="inline-start" />
            Bibliothek
            {untitledCount > 0 ? (
              <Badge variant="secondary" className="ml-1">
                {untitledCount}
              </Badge>
            ) : null}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "storage" ? "default" : "outline"}
            onClick={() => onViewChange("storage")}
          >
            <HardDriveIcon data-icon="inline-start" />
            Speicher
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "settings" ? "default" : "outline"}
            onClick={() => onViewChange("settings")}
          >
            <SettingsIcon data-icon="inline-start" />
            Einstellungen
          </Button>
        </ButtonGroup>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <ObsStatusPill status={obsStatus} />
        {view === "library" && connected
          ? presets.map(({ seconds, label, hint }) => {
              const active = lastSeconds === seconds;
              return (
                <Button
                  key={seconds}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  disabled={!canClip}
                  title={disabledReason ?? hint}
                  onClick={() => onCreate(seconds)}
                >
                  <ClockIcon data-icon="inline-start" />
                  {label}
                </Button>
              );
            })
          : null}
        {untitledCount > 0 && view !== "library" ? (
          <Button type="button" size="sm" variant="ghost" onClick={onUntitled}>
            <FilePenIcon data-icon="inline-start" />
            {untitledCount} unbenannt
          </Button>
        ) : null}
      </div>
    </header>
  );
}
