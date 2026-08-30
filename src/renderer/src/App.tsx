import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { AppConfigDto, ClipRecord, ObsStatus } from "@shared/ipc";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import {
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { formatDuration } from "./format";
import { formatHotkey } from "@shared/hotkeys";
import { AppSidebar, type AppView } from "./components/AppSidebar";
import { ClipActions } from "./components/ClipActions";
import { CommandBar } from "./components/CommandBar";
import {
  RecentClips,
  type ClipFilter,
} from "./components/RecentClips";
import { SettingsPanel } from "./components/settings/SettingsPanel";
import { useTopLoader } from "./components/TopLoadingBar";

function untitledCount(clips: ClipRecord[]): number {
  return clips.filter((c) => !c.namedByUser && !c.missing).length;
}

export function App() {
  const loader = useTopLoader();
  const [config, setConfig] = useState<AppConfigDto | null>(null);
  const [obsStatus, setObsStatus] = useState<ObsStatus | null>(null);
  const [clips, setClips] = useState<ClipRecord[]>([]);
  const [clippingBusy, setClippingBusy] = useState(false);
  const [clipMessage, setClipMessage] = useState<{
    text: string;
    kind: "ok" | "err";
  } | null>(null);
  const [view, setView] = useState<AppView>("library");
  const [filter, setFilter] = useState<ClipFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastSeconds, setLastSeconds] = useState<number | null>(null);
  const selectNewestRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    async function boot(): Promise<void> {
      const [cfg, status, list] = await Promise.all([
        window.api.getConfig(),
        window.api.getObsStatus(),
        window.api.listClips(),
      ]);
      if (cancelled) return;
      setConfig(cfg);
      setObsStatus(status);
      setClips(list);
      setSelectedId(list[0]?.id ?? null);
    }

    loader.begin();
    void boot().finally(() => {
      if (!cancelled) loader.end();
    });
    unsubs.push(window.api.onObsStatus(setObsStatus));
    unsubs.push(window.api.onClipsChanged(setClips));
    unsubs.push(
      window.api.onHotkeysFailed((accelerators) => {
        toast.error(
          `Tastenkürzel belegt: ${accelerators.map((item) => formatHotkey(item)).join(", ")}`,
        );
      }),
    );
    unsubs.push(
      window.api.onHotkeyClip(({ seconds, result, title }) => {
        if (result.ok) {
          setLastSeconds(seconds);
          selectNewestRef.current = true;
          const named = title?.trim();
          setClipMessage({
            text: named
              ? `Die letzten ${formatDuration(seconds)} wurden als „${named}“ gespeichert.`
              : `Die letzten ${formatDuration(seconds)} wurden gespeichert. Benenne den Clip unten um, um die Datei anzupassen.`,
            kind: "ok",
          });
          toast.success(named ? `„${named}“ gespeichert.` : "Clip gespeichert.");
        } else {
          setClipMessage({ text: result.error, kind: "err" });
          toast.error(result.error);
        }
      }),
    );

    return () => {
      cancelled = true;
      loader.end();
      for (const unsub of unsubs) unsub();
    };
  }, []);

  useEffect(() => {
    if (!selectNewestRef.current) return;
    const newest = clips[0];
    if (!newest) return;
    setSelectedId(newest.id);
    selectNewestRef.current = false;
  }, [clips]);

  async function saveConfig(next: AppConfigDto): Promise<AppConfigDto> {
    const saved = await loader.wrap(() => window.api.saveConfig(next));
    setConfig(saved);
    return saved;
  }

  async function createClip(seconds: number): Promise<void> {
    setClippingBusy(true);
    setClipMessage(null);
    try {
      const result = await loader.wrap(() => window.api.createClip(seconds));
      if (result.ok) {
        setLastSeconds(seconds);
        selectNewestRef.current = true;
        setClipMessage({
          text: `Die letzten ${formatDuration(seconds)} wurden gespeichert. Benenne den Clip unten um, um die Datei anzupassen.`,
          kind: "ok",
        });
        toast.success("Clip gespeichert.");
      } else {
        setClipMessage({ text: result.error, kind: "err" });
        toast.error(result.error);
      }
    } finally {
      setClippingBusy(false);
    }
  }

  async function openClip(id: string): Promise<void> {
    setSelectedId(id);
    const result = await window.api.openClip(id);
    if (!result.ok) {
      const text = result.error ?? "Clip konnte nicht geöffnet werden";
      setClipMessage({ text, kind: "err" });
      toast.error(text);
    }
  }

  async function renameClip(id: string, name: string): Promise<void> {
    await loader.wrap(async () => {
      const result = await window.api.renameClip(id, name);
      if (!result.ok) {
        setClipMessage({ text: result.error, kind: "err" });
        toast.error(result.error);
        setClips(await window.api.listClips());
        return;
      }
      setClips((prev) => prev.map((c) => (c.id === id ? result.clip : c)));
      toast.success("Clip umbenannt.");
    });
  }

  function revealClip(id: string): void {
    setSelectedId(id);
    void window.api.revealClip(id);
  }

  async function openCutter(id?: string): Promise<void> {
    if (id) setSelectedId(id);
    const result = await window.api.openCutter(id);
    if (!result.ok) {
      const text = result.error ?? "Schneidefenster konnte nicht geöffnet werden.";
      setClipMessage({ text, kind: "err" });
      toast.error(text);
    }
  }

  async function deleteClip(id: string): Promise<void> {
    setSelectedId(id);
    await loader.wrap(async () => {
      const result = await window.api.deleteClip(id);
      if (!result.ok) {
        const text = result.error ?? "Clip konnte nicht gelöscht werden";
        setClipMessage({ text, kind: "err" });
        toast.error(text);
        setClips(await window.api.listClips());
        return;
      }
      setClips((prev) => prev.filter((c) => c.id !== id));
      setSelectedId((current) => {
        if (current !== id) return current;
        const remaining = clips.filter((c) => c.id !== id);
        return remaining[0]?.id ?? null;
      });
      toast.success("Clip gelöscht.");
    });
  }

  if (!config) {
    return (
      <TooltipProvider>
        <SidebarProvider className="h-full min-h-0">
          <Sidebar collapsible="icon">
            <SidebarHeader>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuSkeleton showIcon />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <SidebarInset className="min-h-0 overflow-hidden">
            <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
              <Skeleton className="size-7" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-7 w-14" />
            </header>
            <div className="flex flex-1 flex-col gap-4 px-5 py-5">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </SidebarInset>
        </SidebarProvider>
        <Toaster theme="dark" />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <SidebarProvider className="h-full min-h-0">
        <AppSidebar
          view={view}
          onViewChange={setView}
          untitledCount={untitledCount(clips)}
          onUntitled={() => {
            setView("library");
            setFilter("untitled");
          }}
          onOpenCutter={() => void openCutter()}
        />

        <SidebarInset className="min-h-0 overflow-hidden">
          <CommandBar
            obsStatus={obsStatus}
            busy={clippingBusy}
            lastSeconds={lastSeconds}
            clipPresets={config.CLIP_PRESETS}
            clipScene={config.OBS_SCENE}
            onCreate={(seconds) => void createClip(seconds)}
            onGoToObsSettings={() => setView("obs")}
          />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {view === "library" ? (
              <div className="flex flex-col gap-5">
                <ClipActions
                  busy={clippingBusy}
                  obsStatus={obsStatus}
                  clipScene={config.OBS_SCENE}
                  message={clipMessage}
                />
                <RecentClips
                  clips={clips}
                  filter={filter}
                  onFilterChange={setFilter}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onOpen={(id) => void openClip(id)}
                  onRename={(id, name) => void renameClip(id, name)}
                  onReveal={revealClip}
                  onDelete={(id) => deleteClip(id)}
                  onCut={(id) => void openCutter(id)}
                />
              </div>
            ) : (
              <SettingsPanel
                section={view}
                config={config}
                replayMaxSeconds={obsStatus?.replayMaxSeconds ?? null}
                onSave={saveConfig}
                onGoToObsSettings={() => setView("obs")}
              />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster theme="dark" />
    </TooltipProvider>
  );
}
