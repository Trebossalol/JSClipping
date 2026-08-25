import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { APP_NAME } from "@shared/app.config";
import type { AppConfigDto, ObsStatus } from "@shared/ipc";
import { formatDuration } from "@/format";
import {
  ClockIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { getClipAvailability } from "./components/ClipActions";
import logoUrl from "../../../resources/logo.svg";

export function isQuickActionRoute(): boolean {
  return window.location.hash.replace(/^#/, "") === "quick";
}

export function QuickActionApp() {
  const [config, setConfig] = useState<AppConfigDto | null>(null);
  const [obsStatus, setObsStatus] = useState<ObsStatus | null>(null);

  const reload = useCallback(async () => {
    const [nextConfig, nextStatus] = await Promise.all([
      window.api.getConfig(),
      window.api.getObsStatus(),
    ]);
    setConfig(nextConfig);
    setObsStatus(nextStatus);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("quick-action");
    return () => {
      document.documentElement.classList.remove("quick-action");
    };
  }, []);

  useEffect(() => {
    void reload();
    const unsubs = [
      window.api.onObsStatus(setObsStatus),
      window.api.onQuickActionOpened(() => {
        void reload();
      }),
    ];
    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [reload]);

  const presets = config?.CLIP_PRESETS ?? [];
  const { connected, replayOff, canClip } = getClipAvailability(
    obsStatus,
    false,
  );
  const replayMax = obsStatus?.replayMaxSeconds ?? null;

  const selectPreset = useCallback((seconds: number) => {
    void window.api.selectQuickAction(seconds);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        void window.api.closeQuickAction();
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const index = Number(event.key) - 1;
      if (!Number.isInteger(index) || index < 0 || index >= presets.length) {
        return;
      }
      const preset = presets[index];
      if (!preset) return;
      const overBuffer = replayMax != null && preset.seconds > replayMax;
      if (!canClip || overBuffer) return;
      event.preventDefault();
      selectPreset(preset.seconds);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canClip, presets, replayMax, selectPreset]);

  return (
    <div className="flex h-full items-start justify-center p-2">
      <Card size="sm" className="w-full shadow-lg">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <img src={logoUrl} alt="" className="size-6 rounded-md" />
            Clip speichern
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {replayOff ? (
            <Alert className="mx-(--card-spacing) mb-2">
              <TriangleAlertIcon />
              <AlertTitle>Wiederholungspuffer ist aus</AlertTitle>
              <AlertDescription>
                Starte ihn in OBS, dann kannst du clippen.
              </AlertDescription>
            </Alert>
          ) : !connected ? (
            <Alert variant="warning" className="mx-(--card-spacing) mb-2">
              <TriangleAlertIcon />
              <AlertTitle>OBS ist nicht verbunden</AlertTitle>
              <AlertDescription>
                Ohne Verbindung kann kein Clip gespeichert werden.
              </AlertDescription>
            </Alert>
          ) : null}
          <Command loop>
            <CommandList>
              <CommandGroup>
                {presets.map((preset, index) => {
                  const overBuffer =
                    replayMax != null && preset.seconds > replayMax;
                  const disabled = !canClip || overBuffer;
                  return (
                    <CommandItem
                      key={preset.seconds}
                      value={`${preset.seconds} ${formatDuration(preset.seconds)}`}
                      disabled={disabled}
                      onSelect={() => {
                        if (disabled) return;
                        selectPreset(preset.seconds);
                      }}
                    >
                      <ClockIcon />
                      Letzte {formatDuration(preset.seconds)}
                      <CommandShortcut>{index + 1}</CommandShortcut>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
          <p className="px-(--card-spacing) pt-1 text-xs text-muted-foreground">
            Esc schließt das Menü
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
