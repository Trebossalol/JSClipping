import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ClipRecord, CutRange } from "@shared/ipc";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { AlertCircleIcon } from "lucide-react";
import { ClipCutter } from "./components/ClipCutter";

export function parseCutClipId(): string | null {
  const hash = window.location.hash.replace(/^#/, "");
  const match = /^cut\/([^/]+)$/.exec(hash);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function CutterApp({ clipId }: { clipId: string }) {
  const [clip, setClip] = useState<ClipRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cutError, setCutError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      const next = await window.api.getClip(clipId);
      if (cancelled) return;
      if (!next || next.missing) {
        setLoadError("Clip nicht gefunden oder Datei fehlt.");
        setClip(null);
        return;
      }
      setLoadError(null);
      setClip(next);
      document.title = `Schneiden — ${next.name}`;
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [clipId]);

  async function saveCut(ranges: CutRange[]): Promise<void> {
    setBusy(true);
    setCutError(null);
    try {
      const result = await window.api.cutClip(clipId, ranges);
      if (!result.ok) {
        setCutError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Neuer Clip gespeichert.");
      window.setTimeout(() => window.close(), 450);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircleIcon />
          <AlertTitle>Clip nicht verfügbar</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <Button type="button" variant="outline" onClick={() => window.close()}>
          Fenster schließen
        </Button>
        <Toaster theme="dark" />
      </div>
    );
  }

  if (!clip) {
    return (
      <div className="flex h-full flex-col gap-3 p-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-10 w-full" />
        <Toaster theme="dark" />
      </div>
    );
  }

  return (
    <>
      <ClipCutter
        clip={clip}
        busy={busy}
        error={cutError}
        onCancel={() => {
          if (!busy) window.close();
        }}
        onSave={(ranges) => void saveCut(ranges)}
      />
      <Toaster theme="dark" />
    </>
  );
}
