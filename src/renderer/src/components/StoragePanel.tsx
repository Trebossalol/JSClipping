import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import type { StorageInfo } from "@shared/ipc";
import { formatBytes } from "../format";
import {
  AlertCircleIcon,
  FolderIcon,
  HardDriveIcon,
  RefreshCwIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTopLoader } from "./TopLoadingBar";

const POLL_MS = 10_000;

interface StoragePanelProps {
  className?: string;
}

function ratioToSliderValue(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  return Math.min(100, Math.round(ratio * 1000) / 10);
}

function formatPercent(ratio: number): string {
  const pct = ratio * 100;
  if (pct > 0 && pct < 0.1) return "< 0,1 %";
  return `${pct.toLocaleString("de-DE", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })} %`;
}

function StorageLegendItem({
  label,
  value,
  percent,
  swatchClassName,
}: {
  label: string;
  value: string;
  percent: string;
  swatchClassName: string;
}) {
  return (
    <div className="flex min-w-24 flex-1 flex-col gap-0.5">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={cn("size-2 shrink-0 rounded-full", swatchClassName)} />
        {label}
      </span>
      <span className="truncate font-medium tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {percent}
      </span>
    </div>
  );
}

export function StoragePanel({ className }: StoragePanelProps) {
  const loader = useTopLoader();
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (quiet = false): Promise<void> => {
    if (!quiet) setLoading(true);
    try {
      const result = await (quiet
        ? window.api.getStorage()
        : loader.wrap(() => window.api.getStorage()));
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
  }, [loader]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh(true);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const usedBytes = info ? Math.max(0, info.totalBytes - info.freeBytes) : 0;
  const clipsBytes = info ? Math.min(info.clipsBytes, usedBytes) : 0;
  const otherBytes = Math.max(0, usedBytes - clipsBytes);
  const usedRatio =
    info && info.totalBytes > 0 ? Math.min(1, usedBytes / info.totalBytes) : 0;
  const clipsRatio =
    info && info.totalBytes > 0
      ? Math.min(usedRatio, clipsBytes / info.totalBytes)
      : 0;
  const otherRatio =
    info && info.totalBytes > 0 ? Math.max(0, usedRatio - clipsRatio) : 0;
  const freeRatio = info && info.totalBytes > 0 ? 1 - usedRatio : 0;

  const clipsPct = ratioToSliderValue(clipsRatio);
  const usedPct = ratioToSliderValue(usedRatio);

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <HardDriveIcon className="size-4" />
          Speicher
        </CardTitle>
        <CardDescription>
          Belegung des Datenträgers, auf dem der Clip-Ordner liegt
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => void refresh()}
          >
            {loading ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RefreshCwIcon data-icon="inline-start" />
            )}
            Aktualisieren
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {error ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Speicherplatz unbekannt</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {loading && !info ? (
            <Field>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-4 w-48" />
            </Field>
          ) : info ? (
            <Field>
              <FieldLabel id="storage-usage-label">Datenträger</FieldLabel>
              <div
                role="meter"
                aria-labelledby="storage-usage-label"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(usedRatio * 100)}
                aria-valuetext={`${formatBytes(usedBytes)} belegt, davon ${formatBytes(clipsBytes)} Clips, ${formatBytes(info.freeBytes)} frei`}
                className="w-full"
                style={
                  {
                    "--clips-pct": `${clipsPct}%`,
                  } as CSSProperties
                }
              >
                <Slider
                  aria-hidden
                  tabIndex={-1}
                  min={0}
                  max={100}
                  step={0.1}
                  minStepsBetweenThumbs={0}
                  value={[clipsPct, usedPct]}
                  className={cn(
                    "pointer-events-none",
                    "**:data-[slot=slider-track]:h-2",
                    "**:data-[slot=slider-track]:bg-[linear-gradient(to_right,var(--primary)_var(--clips-pct),var(--muted)_var(--clips-pct))]",
                    "**:data-[slot=slider-range]:bg-primary/40",
                  )}
                />
              </div>
            </Field>
          ) : null}
        </FieldGroup>
      </CardContent>
      {info ? (
        <CardFooter className="flex flex-wrap gap-3">
          <StorageLegendItem
            label="Clips"
            value={formatBytes(clipsBytes)}
            percent={formatPercent(clipsRatio)}
            swatchClassName="bg-primary"
          />
          <StorageLegendItem
            label="Andere Dateien"
            value={formatBytes(otherBytes)}
            percent={formatPercent(otherRatio)}
            swatchClassName="bg-primary/40"
          />
          <StorageLegendItem
            label="Frei"
            value={formatBytes(info.freeBytes)}
            percent={formatPercent(freeRatio)}
            swatchClassName="bg-muted ring-1 ring-border"
          />
        </CardFooter>
      ) : loading ? (
        <CardFooter className="flex flex-wrap gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardFooter>
      ) : null}
    </Card>
  );
}
