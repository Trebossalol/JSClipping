import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { StorageInfo } from "@shared/ipc";
import { formatBytes } from "../format";
import {
  AlertCircleIcon,
  FolderIcon,
  HardDriveIcon,
  RefreshCwIcon,
} from "lucide-react";

const POLL_MS = 10_000;

export function StoragePanel() {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (quiet = false): Promise<void> => {
    if (!quiet) setLoading(true);
    try {
      const result = await window.api.getStorage();
      if (result.ok) {
        setInfo(result.info);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh(true);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const usedBytes = info ? Math.max(0, info.totalBytes - info.freeBytes) : 0;
  const usedRatio =
    info && info.totalBytes > 0 ? Math.min(1, usedBytes / info.totalBytes) : 0;
  const clipsRatio =
    info && info.totalBytes > 0
      ? Math.min(1, info.clipsBytes / info.totalBytes)
      : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <HardDriveIcon className="size-3.5" />
          Speicher
        </p>
        <p className="text-xs text-muted-foreground">
          Freier Platz auf dem Datenträger des Clip-Ordners
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-auto"
          disabled={loading}
          onClick={() => void refresh()}
        >
          <RefreshCwIcon data-icon="inline-start" />
          Aktualisieren
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Speicherplatz unbekannt</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading && !info ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="mt-3 h-4 w-48" />
          </CardContent>
        </Card>
      ) : info ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <HardDriveIcon className="size-4" />
              Datenträger
            </CardTitle>
            <CardDescription className="break-all">
              {formatBytes(info.freeBytes)} frei von {formatBytes(info.totalBytes)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div
              className="relative h-3 overflow-hidden rounded-full bg-muted"
              role="meter"
              aria-label="Belegter Speicher"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(usedRatio * 100)}
            >
              <div
                className="absolute inset-y-0 left-0 bg-primary/70"
                style={{ width: `${usedRatio * 100}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-primary"
                style={{ width: `${clipsRatio * 100}%` }}
              />
            </div>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <FolderIcon className="mt-px size-3.5 shrink-0" />
              <span className="min-w-0 break-all">
                Clip-Ordner {info.outputDir} — {formatBytes(info.clipsBytes)}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Belegt gesamt {formatBytes(usedBytes)}. Der dunklere Anteil der
              Leiste ist der Clip-Ordner.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
