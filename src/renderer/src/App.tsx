import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AppConfigDto, ClipRecord, ObsStatus } from "@shared/ipc";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { ClipActions } from "./components/ClipActions";
import { ObsStatusPill } from "./components/ObsStatusPill";
import { RecentClips } from "./components/RecentClips";
import { SettingsPanel } from "./components/SettingsPanel";

export function App() {
  const [config, setConfig] = useState<AppConfigDto | null>(null);
  const [obsStatus, setObsStatus] = useState<ObsStatus | null>(null);
  const [clips, setClips] = useState<ClipRecord[]>([]);
  const [clippingBusy, setClippingBusy] = useState(false);
  const [clipMessage, setClipMessage] = useState<{
    text: string;
    kind: "ok" | "err";
  } | null>(null);

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
    }

    void boot();
    unsubs.push(window.api.onObsStatus(setObsStatus));
    unsubs.push(window.api.onClipsChanged(setClips));

    return () => {
      cancelled = true;
      for (const unsub of unsubs) unsub();
    };
  }, []);

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
        setClipMessage({ text: `Saved: ${result.outputPath}`, kind: "ok" });
        toast.success("Clip saved.");
      } else {
        setClipMessage({ text: result.error, kind: "err" });
        toast.error(result.error);
      }
    } finally {
      setClippingBusy(false);
    }
  }

  async function openClip(id: string): Promise<void> {
    const result = await window.api.openClip(id);
    if (!result.ok) {
      const text = result.error ?? "Could not open clip";
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
    toast.success("Clip renamed.");
  }

  function revealClip(id: string): void {
    void window.api.revealClip(id);
  }

  if (!config) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
        <Toaster />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">JSClipping</h1>
          <p className="text-sm text-muted-foreground">
            OBS Replay Buffer companion
          </p>
        </div>
        <ObsStatusPill status={obsStatus} />
      </header>

      <ClipActions
        busy={clippingBusy}
        message={clipMessage}
        onCreate={(seconds) => void createClip(seconds)}
      />

      <SettingsPanel config={config} onSave={saveConfig} />

      <RecentClips
        clips={clips}
        onOpen={(id) => void openClip(id)}
        onRename={(id, name) => void renameClip(id, name)}
        onReveal={revealClip}
      />

      <Toaster />
    </div>
  );
}
