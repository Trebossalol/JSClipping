import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ObsStatus } from "@shared/ipc";
import {
  ChevronDownIcon,
  ClockIcon,
  FilePenIcon,
  LibraryIcon,
  ScissorsIcon,
  SettingsIcon,
} from "lucide-react";
import { CLIP_PRESETS, getClipAvailability } from "./ClipActions";
import { ObsStatusPill } from "./ObsStatusPill";

export type AppView = "library" | "settings";

interface AppHeaderProps {
  view: AppView;
  onViewChange: (view: AppView) => void;
  obsStatus: ObsStatus | null;
  untitledCount: number;
  onUntitled: () => void;
  busy: boolean;
  lastSeconds: number | null;
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
  onCreate,
}: AppHeaderProps) {
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant="outline">
              {view === "library" ? (
                <LibraryIcon data-icon="inline-start" />
              ) : (
                <SettingsIcon data-icon="inline-start" />
              )}
              {view === "library" ? "Bibliothek" : "Einstellungen"}
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onViewChange("library")}>
              <LibraryIcon />
              Bibliothek
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewChange("settings")}>
              <SettingsIcon />
              Einstellungen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <ObsStatusPill status={obsStatus} />
        {connected
          ? CLIP_PRESETS.map(({ seconds, label, hint }) => {
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
      </div>
    </header>
  );
}
