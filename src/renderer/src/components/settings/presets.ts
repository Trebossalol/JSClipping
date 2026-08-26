import { MIN_CLIP_PRESET_SECONDS } from "@shared/app.config";
import {
  defaultClipPresets,
  normalizeClipPresets,
  type ClipPreset,
} from "@shared/ipc";
import { normalizeHotkey } from "@shared/hotkeys";
import { formatDuration } from "@/format";

export interface PresetDraft {
  id: number;
  minutes: string;
  seconds: string;
  hotkey: string | null;
}

const SUGGESTED_PRESET_SECONDS = [
  15, 30, 45, 60, 90, 120, 180, 300, 600, 900, 1200, 1800, 3600,
];

export function parseDurationParts(
  minutes: string,
  seconds: string,
  maxSeconds: number | null,
): number | null {
  const minRaw = minutes.trim() === "" ? 0 : Number(minutes);
  const secRaw = seconds.trim() === "" ? 0 : Number(seconds);
  if (!Number.isFinite(minRaw) || !Number.isFinite(secRaw)) return null;
  if (!Number.isInteger(minRaw) || !Number.isInteger(secRaw)) return null;
  if (minRaw < 0 || secRaw < 0) return null;
  const total = minRaw * 60 + secRaw;
  if (total < MIN_CLIP_PRESET_SECONDS) return null;
  if (maxSeconds != null && total > maxSeconds) return null;
  return total;
}

export function draftsFromPresets(
  values: ClipPreset[],
  startId: number,
): { drafts: PresetDraft[]; nextId: number } {
  let id = startId;
  const drafts = values.map((preset) => ({
    id: id++,
    minutes: String(Math.floor(preset.seconds / 60)),
    seconds: String(preset.seconds % 60),
    hotkey: preset.hotkey,
  }));
  return { drafts, nextId: id };
}

export function defaultPresetsForMax(maxSeconds: number | null): ClipPreset[] {
  const defaults = defaultClipPresets();
  if (maxSeconds == null) return defaults;
  const fitted = defaults.filter((preset) => preset.seconds <= maxSeconds);
  return fitted.length > 0
    ? fitted
    : [{ seconds: maxSeconds, hotkey: null }];
}

export function nextPresetSeconds(
  existing: number[],
  maxSeconds: number | null,
): number {
  for (const candidate of SUGGESTED_PRESET_SECONDS) {
    if (maxSeconds != null && candidate > maxSeconds) continue;
    if (!existing.includes(candidate)) return candidate;
  }
  if (maxSeconds == null) {
    let s = MIN_CLIP_PRESET_SECONDS;
    while (existing.includes(s)) s += 1;
    return s;
  }
  for (let s = MIN_CLIP_PRESET_SECONDS; s <= maxSeconds; s++) {
    if (!existing.includes(s)) return s;
  }
  return maxSeconds;
}

export function duplicatePresetSeconds(
  drafts: PresetDraft[],
  maxSeconds: number | null,
): Set<number> {
  const counts = new Map<number, number>();
  for (const draft of drafts) {
    const total = parseDurationParts(draft.minutes, draft.seconds, maxSeconds);
    if (total == null) continue;
    counts.set(total, (counts.get(total) ?? 0) + 1);
  }
  const dups = new Set<number>();
  for (const [seconds, count] of counts) {
    if (count > 1) dups.add(seconds);
  }
  return dups;
}

export function presetRangeError(maxSeconds: number | null): string {
  if (maxSeconds == null) {
    return `Jedes Preset braucht eine Dauer von mindestens ${formatDuration(MIN_CLIP_PRESET_SECONDS)}.`;
  }
  return `Jedes Preset braucht eine Dauer zwischen ${formatDuration(MIN_CLIP_PRESET_SECONDS)} und ${formatDuration(maxSeconds)} (OBS-Puffer).`;
}

export function duplicatePresetHotkeys(
  drafts: PresetDraft[],
  extra?: string | null,
): Set<string> {
  const counts = new Map<string, number>();
  for (const draft of drafts) {
    const hotkey = draft.hotkey ? normalizeHotkey(draft.hotkey) : null;
    if (!hotkey) continue;
    counts.set(hotkey, (counts.get(hotkey) ?? 0) + 1);
  }
  if (extra) {
    const extraHotkey = normalizeHotkey(extra);
    if (extraHotkey) {
      counts.set(extraHotkey, (counts.get(extraHotkey) ?? 0) + 1);
    }
  }
  const dups = new Set<string>();
  for (const [hotkey, count] of counts) {
    if (count > 1) dups.add(hotkey);
  }
  return dups;
}

export function collectClipPresets(
  drafts: PresetDraft[],
  maxSeconds: number | null,
): { ok: true; values: ClipPreset[] } | { ok: false; error: string } {
  if (drafts.length === 0) {
    return { ok: false, error: "Mindestens ein Clip-Preset." };
  }
  const parsed: ClipPreset[] = [];
  const hotkeys = new Set<string>();
  for (const draft of drafts) {
    const total = parseDurationParts(draft.minutes, draft.seconds, maxSeconds);
    if (total == null) {
      return { ok: false, error: presetRangeError(maxSeconds) };
    }
    let hotkey: string | null = null;
    if (draft.hotkey) {
      hotkey = normalizeHotkey(draft.hotkey);
      if (!hotkey) {
        return {
          ok: false,
          error:
            "Ungültiges Tastenkürzel. Mindestens Strg, Alt oder Windows plus eine Taste.",
        };
      }
      if (hotkeys.has(hotkey)) {
        return {
          ok: false,
          error: "Jedes Tastenkürzel darf nur einmal vorkommen.",
        };
      }
      hotkeys.add(hotkey);
    }
    parsed.push({ seconds: total, hotkey });
  }
  return { ok: true, values: normalizeClipPresets(parsed) };
}
