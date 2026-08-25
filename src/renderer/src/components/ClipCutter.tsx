import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { MIN_CUT_RANGE_SECONDS } from "@shared/app.config";
import { type ClipRecord, type CutRange } from "@shared/ipc";
import { formatBytes, formatDuration, formatTimecode, parseTimecode } from "../format";
import {
  PauseIcon,
  PlayIcon,
  ScissorsIcon,
  SplitIcon,
  Trash2Icon,
} from "lucide-react";

type KeepRange = CutRange & { id: string };

type DragState =
  | { kind: "playhead" }
  | { kind: "range"; id: string; edge: "start" | "end" }
  | null;

function newRangeId(): string {
  return crypto.randomUUID();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sortedRanges(ranges: KeepRange[]): KeepRange[] {
  return [...ranges].sort((a, b) => a.start - b.start);
}

function keepTotal(ranges: KeepRange[]): number {
  return ranges.reduce((sum, range) => sum + Math.max(0, range.end - range.start), 0);
}

function boundsFor(
  ranges: KeepRange[],
  id: string,
  duration: number,
): { minStart: number; maxEnd: number } {
  const sorted = sortedRanges(ranges);
  const index = sorted.findIndex((range) => range.id === id);
  const prev = index > 0 ? sorted[index - 1] : undefined;
  const next = index >= 0 && index < sorted.length - 1 ? sorted[index + 1] : undefined;
  return {
    minStart: prev?.end ?? 0,
    maxEnd: next?.start ?? duration,
  };
}

function applyRange(
  ranges: KeepRange[],
  id: string,
  start: number,
  end: number,
  duration: number,
): KeepRange[] {
  const { minStart, maxEnd } = boundsFor(ranges, id, duration);
  let nextStart = clamp(start, minStart, Math.max(minStart, maxEnd - MIN_CUT_RANGE_SECONDS));
  let nextEnd = clamp(end, nextStart + MIN_CUT_RANGE_SECONDS, maxEnd);
  if (nextEnd - nextStart < MIN_CUT_RANGE_SECONDS) return ranges;
  nextStart = clamp(nextStart, minStart, nextEnd - MIN_CUT_RANGE_SECONDS);
  return ranges.map((range) =>
    range.id === id ? { ...range, start: nextStart, end: nextEnd } : range,
  );
}

function splitRangeAt(
  ranges: KeepRange[],
  playhead: number,
): { ranges: KeepRange[]; selectedId: string } | { error: string } {
  const target = ranges.find(
    (range) => playhead > range.start && playhead < range.end,
  );
  if (!target) {
    return { error: "Die Abspielposition liegt in keinem Abschnitt." };
  }
  if (
    playhead - target.start < MIN_CUT_RANGE_SECONDS ||
    target.end - playhead < MIN_CUT_RANGE_SECONDS
  ) {
    return { error: "Zu nah am Rand, um den Abschnitt zu teilen." };
  }
  const left: KeepRange = { ...target, end: playhead };
  const right: KeepRange = { id: newRangeId(), start: playhead, end: target.end };
  return {
    ranges: ranges.flatMap((range) => (range.id === target.id ? [left, right] : range)),
    selectedId: right.id,
  };
}

function neighborId(ranges: KeepRange[], id: string): string | null {
  const sorted = sortedRanges(ranges);
  const index = sorted.findIndex((range) => range.id === id);
  if (index < 0) return sorted[0]?.id ?? null;
  return sorted[index + 1]?.id ?? sorted[index - 1]?.id ?? null;
}

function timeFromClientX(
  clientX: number,
  el: HTMLElement,
  duration: number,
): number {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0) return 0;
  return clamp(((clientX - rect.left) / rect.width) * duration, 0, duration);
}

interface TimeFieldProps {
  value: number;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
  onCommit: (seconds: number) => void;
}

function TimeField({ value, disabled, ariaLabel, className, onCommit }: TimeFieldProps) {
  const [text, setText] = useState(formatTimecode(value));

  useEffect(() => {
    setText(formatTimecode(value));
  }, [value]);

  function commit(): void {
    const parsed = parseTimecode(text);
    if (parsed == null) {
      setText(formatTimecode(value));
      return;
    }
    onCommit(parsed);
  }

  return (
    <Input
      value={text}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "h-7 w-[4.75rem] px-1.5 text-center font-mono text-xs",
        className,
      )}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

interface ClipCutterProps {
  clip: ClipRecord;
  busy: boolean;
  active?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSave: (ranges: CutRange[]) => void;
}

export function ClipCutter({
  clip,
  busy,
  active = true,
  error,
  onCancel,
  onSave,
}: ClipCutterProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>(null);
  const scrubbingRef = useRef(false);
  const scrubRafRef = useRef<number | null>(null);
  const [duration, setDuration] = useState(clip.durationSeconds ?? 0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ranges, setRanges] = useState<KeepRange[]>(() => {
    const initial = clip.durationSeconds ?? 0;
    if (initial <= MIN_CUT_RANGE_SECONDS) return [];
    return [{ id: newRangeId(), start: 0, end: initial }];
  });
  const [selectedId, setSelectedId] = useState<string | null>(
    () => ranges[0]?.id ?? null,
  );
  const [gapHint, setGapHint] = useState<string | null>(null);
  const currentTimeRef = useRef(0);
  const rangesRef = useRef(ranges);
  const selectedIdRef = useRef(selectedId);
  rangesRef.current = ranges;
  selectedIdRef.current = selectedId;
  currentTimeRef.current = currentTime;

  const selected = ranges.find((range) => range.id === selectedId) ?? null;
  const totalKeep = keepTotal(ranges);
  const canSave =
    !busy &&
    duration > 0 &&
    ranges.length > 0 &&
    totalKeep >= MIN_CUT_RANGE_SECONDS;

  useEffect(() => {
    if (!active) {
      videoRef.current?.pause();
      return;
    }
    function onKey(e: KeyboardEvent): void {
      if (document.querySelector('[data-slot="dialog-content"]')) return;
      if (e.key === "Escape" && !busy) {
        onCancel();
        return;
      }
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (typing) return;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        void togglePlay();
        return;
      }
      if (
        (e.key === "s" || e.key === "S") &&
        !busy &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        applySplit(currentTimeRef.current);
        return;
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !busy &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        removeSelected();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, busy, onCancel]);

  useEffect(() => {
    function onMove(e: PointerEvent): void {
      const drag = dragRef.current;
      const track = trackRef.current;
      if (!drag || !track || duration <= 0) return;
      const time = timeFromClientX(e.clientX, track, duration);
      scrubTo(time);
      if (drag.kind === "range") {
        setRanges((prev) => {
          const range = prev.find((item) => item.id === drag.id);
          if (!range) return prev;
          if (drag.edge === "start") {
            return applyRange(prev, drag.id, time, range.end, duration);
          }
          return applyRange(prev, drag.id, range.start, time, duration);
        });
      }
    }
    function finishScrub(): void {
      if (!dragRef.current) return;
      dragRef.current = null;
      const video = videoRef.current;
      if (video) {
        video.currentTime = currentTimeRef.current;
        const done = (): void => {
          scrubbingRef.current = false;
        };
        video.addEventListener("seeked", done, { once: true });
        window.setTimeout(done, 400);
      } else {
        scrubbingRef.current = false;
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finishScrub);
    window.addEventListener("pointercancel", finishScrub);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finishScrub);
      window.removeEventListener("pointercancel", finishScrub);
    };
  }, [duration]);

  function scrubTo(time: number): void {
    const next = clamp(time, 0, duration || 0);
    currentTimeRef.current = next;
    setCurrentTime(next);
    if (scrubRafRef.current != null) return;
    scrubRafRef.current = window.requestAnimationFrame(() => {
      scrubRafRef.current = null;
      const video = videoRef.current;
      if (video) video.currentTime = currentTimeRef.current;
    });
  }

  async function togglePlay(): Promise<void> {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      video.pause();
      return;
    }
    const target = currentTimeRef.current;
    if (Math.abs(video.currentTime - target) > 0.05) {
      scrubbingRef.current = true;
      video.currentTime = target;
      await new Promise<void>((resolve) => {
        const done = (): void => {
          video.removeEventListener("seeked", done);
          resolve();
        };
        video.addEventListener("seeked", done);
        window.setTimeout(done, 500);
      });
      scrubbingRef.current = false;
      if (Math.abs(video.currentTime - target) > 0.25) {
        video.currentTime = target;
      }
    }
    try {
      await video.play();
    } catch {
      // Play can abort if a seek is still in flight.
    }
  }

  function onMeta(): void {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const next = video.duration;
    setDuration(next);
    setRanges((prev) => {
      if (prev.length > 0) {
        return prev.map((range) => ({
          ...range,
          start: clamp(range.start, 0, next),
          end: clamp(range.end, 0, next),
        }));
      }
      const full: KeepRange = { id: newRangeId(), start: 0, end: next };
      setSelectedId(full.id);
      return [full];
    });
  }

  function startDrag(state: DragState, event: ReactPointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    scrubbingRef.current = true;
    dragRef.current = state;
    if (state?.kind === "playhead") {
      videoRef.current?.pause();
    }
    if (state?.kind === "range") setSelectedId(state.id);
  }

  function applySplit(playhead: number): void {
    const result = splitRangeAt(rangesRef.current, playhead);
    if ("error" in result) {
      setGapHint(result.error);
      return;
    }
    setGapHint(null);
    setRanges(result.ranges);
    setSelectedId(result.selectedId);
  }

  function removeSelected(): void {
    const id = selectedIdRef.current;
    if (!id) {
      setGapHint("Klicke zuerst einen Abschnitt an.");
      return;
    }
    const current = rangesRef.current;
    if (current.length <= 1) {
      setGapHint("Teile zuerst mit S, dann lösche den ungewollten Abschnitt.");
      return;
    }
    const next = current.filter((range) => range.id !== id);
    setGapHint(null);
    setRanges(next);
    setSelectedId(neighborId(current, id));
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-start justify-between gap-3 border-b bg-card px-4 py-3">
        <div className="min-w-0">
          <h2
            id="cut-clip-title"
            className="flex items-center gap-1.5 text-sm font-medium"
          >
            <ScissorsIcon className="size-4" />
            Clip schneiden
          </h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {clip.name}
            {clip.fileSizeBytes
              ? ` · ${formatBytes(clip.fileSizeBytes)}`
              : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={onCancel}
        >
          Schließen
        </Button>
      </div>

      <div className="relative min-h-0 flex-1 p-4 pb-0">
        <div className="relative h-full overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            src={clip.mediaUrl ?? undefined}
            preload="auto"
            className="absolute inset-0 h-full w-full object-contain bg-black"
            onLoadedMetadata={onMeta}
            onTimeUpdate={() => {
              if (scrubbingRef.current) return;
              const video = videoRef.current;
              if (video) setCurrentTime(video.currentTime);
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        </div>
      </div>

      <div className="shrink-0 px-4 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={togglePlay}
              disabled={duration <= 0}
            >
              {playing ? (
                <PauseIcon data-icon="inline-start" />
              ) : (
                <PlayIcon data-icon="inline-start" />
              )}
              {playing ? "Pause" : "Abspielen"}
            </Button>
            <p className="font-mono text-xs text-muted-foreground">
              {formatTimecode(currentTime)} / {formatTimecode(duration)}
            </p>
            <div className="ml-auto flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="xs"
                variant="secondary"
                disabled={busy || duration <= 0}
                title="An der Abspielposition teilen (S)"
                onClick={() => applySplit(currentTime)}
              >
                <SplitIcon data-icon="inline-start" />
                Teilen (S)
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={busy || !selected || ranges.length <= 1}
                title="Ausgewählten Abschnitt entfernen (Entf)"
                onClick={removeSelected}
              >
                <Trash2Icon data-icon="inline-start" />
                Löschen (Entf)
              </Button>
            </div>
          </div>

          <div
            ref={trackRef}
            className="relative mt-3"
            role="slider"
            aria-label="Zeitleiste"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(currentTime)}
          >
            <div
              className="h-2.5 cursor-pointer rounded-t-md bg-zinc-800"
              onPointerDown={(e) => {
                if (duration <= 0) return;
                startDrag({ kind: "playhead" }, e);
                if (trackRef.current) {
                  scrubTo(timeFromClientX(e.clientX, trackRef.current, duration));
                }
              }}
            />
            <div
              className="relative h-14 cursor-pointer rounded-b-md bg-muted"
              onPointerDown={(e) => {
                if (duration <= 0) return;
                startDrag({ kind: "playhead" }, e);
                if (trackRef.current) {
                  scrubTo(timeFromClientX(e.clientX, trackRef.current, duration));
                }
              }}
            >
              {sortedRanges(ranges).map((range, index) => {
                const left = duration > 0 ? (range.start / duration) * 100 : 0;
                const widthPct =
                  duration > 0 ? ((range.end - range.start) / duration) * 100 : 0;
                const selectedRange = range.id === selectedId;
                const wide = widthPct >= 18;
                return (
                  <div
                    key={range.id}
                    className={cn(
                      "absolute top-1.5 bottom-1.5 overflow-hidden rounded-md",
                      selectedRange
                        ? "bg-primary ring-1 ring-foreground/30"
                        : "bg-primary/55 hover:bg-primary/70",
                    )}
                    style={{ left: `${left}%`, width: `${Math.max(widthPct, 0.6)}%` }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setSelectedId(range.id);
                      setGapHint(null);
                    }}
                  >
                    <div className="pointer-events-none flex h-full items-center gap-1.5 px-2.5 text-[11px] text-primary-foreground">
                      <span className="shrink-0 font-medium">{index + 1}</span>
                      {wide ? (
                        <>
                          <span className="min-w-0 truncate font-mono opacity-90">
                            {formatTimecode(range.start)}–{formatTimecode(range.end)}
                          </span>
                          <span className="ml-auto shrink-0 opacity-80">
                            {formatDuration(range.end - range.start)}
                          </span>
                        </>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      aria-label={`Start von Abschnitt ${index + 1} verschieben`}
                      className="absolute top-0 bottom-0 left-0 z-10 w-2.5 cursor-ew-resize rounded-l-md bg-primary-foreground/35"
                      onPointerDown={(e) =>
                        startDrag({ kind: "range", id: range.id, edge: "start" }, e)
                      }
                    />
                    <button
                      type="button"
                      aria-label={`Ende von Abschnitt ${index + 1} verschieben`}
                      className="absolute top-0 bottom-0 right-0 z-10 w-2.5 cursor-ew-resize rounded-r-md bg-primary-foreground/35"
                      onPointerDown={(e) =>
                        startDrag({ kind: "range", id: range.id, edge: "end" }, e)
                      }
                    />
                  </div>
                );
              })}
            </div>
            {duration > 0 ? (
              <div
                className="absolute top-0 bottom-0 z-20 w-4 -translate-x-1/2 cursor-ew-resize"
                style={{ left: `${(currentTime / duration) * 100}%` }}
                onPointerDown={(e) => {
                  startDrag({ kind: "playhead" }, e);
                }}
              >
                <div className="mx-auto h-full w-0.5 bg-foreground" />
                <div className="absolute top-0 left-1/2 size-2 -translate-x-1/2 rounded-full bg-foreground" />
              </div>
            ) : null}
          </div>

          {selected ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5">
              <span className="text-xs font-medium">
                Abschnitt{" "}
                {sortedRanges(ranges).findIndex((range) => range.id === selected.id) + 1}
              </span>
              <TimeField
                value={selected.start}
                disabled={busy}
                ariaLabel="Start"
                className="h-6 w-16"
                onCommit={(start) =>
                  setRanges((prev) =>
                    applyRange(prev, selected.id, start, selected.end, duration),
                  )
                }
              />
              <span className="text-xs text-muted-foreground">–</span>
              <TimeField
                value={selected.end}
                disabled={busy}
                ariaLabel="Ende"
                className="h-6 w-16"
                onCommit={(end) =>
                  setRanges((prev) =>
                    applyRange(prev, selected.id, selected.start, end, duration),
                  )
                }
              />
              <span className="text-xs text-muted-foreground">
                {formatDuration(selected.end - selected.start)}
              </span>
            </div>
          ) : null}

          {gapHint ? (
            <p className="mt-1.5 text-xs text-muted-foreground">{gapHint}</p>
          ) : null}

          <p className="mt-2 text-xs text-muted-foreground">
            Behalten: {formatDuration(totalKeep) || "0s"} von{" "}
            {formatDuration(duration) || "0s"}. S teilt an der Abspielposition.
            Abschnitt anklicken, Entf löscht ihn. Der Originalclip bleibt
            erhalten.
          </p>
          {error ? (
            <p className="mt-2 text-sm text-destructive">{error}</p>
          ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap justify-end gap-1.5 border-t px-4 py-3">
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            Abbrechen
          </Button>
          <Button
            type="button"
            disabled={!canSave}
            onClick={() =>
              onSave(
                sortedRanges(ranges).map(({ start, end }) => ({ start, end })),
              )
            }
          >
            {busy ? <Spinner data-icon="inline-start" /> : <ScissorsIcon data-icon="inline-start" />}
            Als neuen Clip speichern
          </Button>
        </div>
    </div>
  );
}
