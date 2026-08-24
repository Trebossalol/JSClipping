import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { AppConfigDto, ClipRecord, ObsStatus } from "@shared/ipc";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { InfoIcon } from "lucide-react";
import { AppHeader, type AppView } from "./components/AppHeader";
import { ClipActions } from "./components/ClipActions";
import {
  RecentClips,
  type ClipFilter,
} from "./components/RecentClips";
import { SettingsPanel } from "./components/SettingsPanel";

function untitledCount(clips: ClipRecord[]): number {
  return clips.filter((c) => !c.namedByUser && !c.missing).length;
}

export function App() {
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

    void boot();
    unsubs.push(window.api.onObsStatus(setObsStatus));
    unsubs.push(window.api.onClipsChanged(setClips));

    return () => {
      cancelled = true;
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
    const saved = await window.api.saveConfig(next);
    setConfig(saved);
    return saved;
  }

  async function createClip(seconds: number): Promise<void> {
    setClippingBusy(true);
    setClipMessage(null);
    try {
      const result = await window.api.createClip(seconds);
      if (result.ok) {
        setLastSeconds(seconds);
        selectNewestRef.current = true;
        setClipMessage({
          text: `Die letzten ${seconds}s wurden gespeichert. Benenne den Clip unten um, um die Datei anzupassen.`,
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
    const result = await window.api.renameClip(id, name);
    if (!result.ok) {
      setClipMessage({ text: result.error, kind: "err" });
      toast.error(result.error);
      setClips(await window.api.listClips());
      return;
    }
    setClips((prev) => prev.map((c) => (c.id === id ? result.clip : c)));
    toast.success("Clip umbenannt.");
  }

  function revealClip(id: string): void {
    setSelectedId(id);
    void window.api.revealClip(id);
  }

  async function deleteClip(id: string): Promise<void> {
    setSelectedId(id);
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
  }

  if (!config) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b bg-card px-5 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-7 w-32" />
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-7 w-14" />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 px-5 py-5">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <Toaster theme="dark" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <AppHeader
        view={view}
        onViewChange={setView}
        obsStatus={obsStatus}
        untitledCount={untitledCount(clips)}
        onUntitled={() => {
          setView("library");
          setFilter("untitled");
        }}
        busy={clippingBusy}
        lastSeconds={lastSeconds}
        onCreate={(seconds) => void createClip(seconds)}
      />

      <main className="flex-1 overflow-y-auto px-5 py-5">
        {view === "library" ? (
          <div className="flex flex-col gap-5">
            <ClipActions
              busy={clippingBusy}
              obsStatus={obsStatus}
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
            />
          </div>
        ) : (
          <SettingsPanel config={config} onSave={saveConfig} />
        )}
      </main>

      <footer className="border-t bg-card px-5 py-2.5">
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <InfoIcon className="mt-px size-3 shrink-0" />
          Beim Schließen des Fensters bleibt JSClipping im Infobereich. Beende
          die App über das Infobereich-Menü.
        </p>
      </footer>

      <Toaster theme="dark" />
    </div>
  );
}
