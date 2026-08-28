import {
  DEFAULT_CLIP_PRESETS,
  MAX_CLIP_PRESETS,
  MIN_CLIP_PRESET_SECONDS,
} from "./app.config.js";
import { normalizeHotkey } from "./hotkeys.js";

export interface ClipPreset {
  seconds: number;
  hotkey: string | null;
}

export function defaultClipPresets(): ClipPreset[] {
  return DEFAULT_CLIP_PRESETS.map((seconds) => ({ seconds, hotkey: null }));
}

export function clipPresetSeconds(presets: ClipPreset[]): number[] {
  return presets.map((preset) => preset.seconds);
}

export function normalizeClipPresets(value: unknown): ClipPreset[] {
  if (!Array.isArray(value)) return defaultClipPresets();
  const out: ClipPreset[] = [];
  const seenSeconds = new Set<number>();
  const seenHotkeys = new Set<string>();
  for (const item of value) {
    let seconds: number;
    let hotkey: string | null = null;
    if (typeof item === "number" || typeof item === "string") {
      seconds = Number(item);
    } else if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      seconds =
        typeof rec.seconds === "number" ? rec.seconds : Number(rec.seconds);
      if (typeof rec.hotkey === "string") {
        hotkey = normalizeHotkey(rec.hotkey);
      }
    } else {
      continue;
    }
    if (!Number.isInteger(seconds)) continue;
    if (seconds < MIN_CLIP_PRESET_SECONDS) continue;
    if (seenSeconds.has(seconds)) continue;
    seenSeconds.add(seconds);
    if (hotkey && seenHotkeys.has(hotkey)) hotkey = null;
    if (hotkey) seenHotkeys.add(hotkey);
    out.push({ seconds, hotkey });
    if (out.length >= MAX_CLIP_PRESETS) break;
  }
  return out.length > 0 ? out : defaultClipPresets();
}

export interface AppConfigDto {
  OBS_URL: string;
  OBS_PASSWORD: string;
  /** Empty = do not force a scene; OBS keeps its current program scene. */
  OBS_SCENE: string;
  CLIP_OUTPUT_DIR: string;
  AUTOSTART: boolean;
  CLIP_PRESETS: ClipPreset[];
  QUICK_ACTION_HOTKEY: string | null;
}

export interface ObsStatus {
  connected: boolean;
  /** True when the OBS process is running, even if WebSocket is down. */
  running: boolean;
  error?: string;
  /** `null` when connected but OBS has not reported buffer state yet. */
  replayBufferActive: boolean | null;
  /** OBS "Maximum Replay Time" in seconds; `null` when disconnected or unknown. */
  replayMaxSeconds: number | null;
  /** Current OBS program scene; `null` when disconnected or unknown. */
  currentScene: string | null;
}

export interface ClipRecord {
  id: string;
  filePath: string;
  name: string;
  createdAt: string;
  durationSeconds: number | null;
  /** Coded frame width; `null` when unknown. */
  width?: number | null;
  /** Coded frame height; `null` when unknown. */
  height?: number | null;
  /** File size in bytes; `null` when the file is missing. */
  fileSizeBytes?: number | null;
  thumbnailPath: string | null;
  /** Custom protocol URL for in-app playback (`media://clip/{id}`). */
  mediaUrl?: string | null;
  missing?: boolean;
  /** True once the user has set a custom title in the app. */
  namedByUser?: boolean;
}

export interface CutRange {
  start: number;
  end: number;
}

/** Target frame size for cutter downscale. Both sides must be ≤ source. */
export interface ScaleTarget {
  width: number;
  height: number;
}

export interface StorageInfo {
  outputDir: string;
  totalBytes: number;
  freeBytes: number;
  clipsBytes: number;
}

export const IpcChannels = {
  getConfig: "config:get",
  saveConfig: "config:save",
  pickOutputDir: "config:pick-output-dir",
  getObsStatus: "obs:get-status",
  obsStatusChanged: "obs:status-changed",
  getObsScenes: "obs:get-scenes",
  createClip: "clip:create",
  listClips: "clips:list",
  clipsChanged: "clips:changed",
  renameClip: "clips:rename",
  deleteClip: "clips:delete",
  cutClip: "clips:cut",
  getClip: "clips:get",
  openCutter: "clips:open-cutter",
  cutterOpenClip: "cutter:open-clip",
  openClip: "clips:open",
  revealClip: "clips:reveal",
  getStorage: "storage:get",
  startObs: "obs:start",
  stopObs: "obs:stop",
  hotkeysFailed: "hotkeys:failed",
  hotkeyClip: "clip:hotkey",
  quickActionOpened: "quick-action:opened",
  closeQuickAction: "quick-action:close",
  selectQuickAction: "quick-action:select",
  openExternal: "shell:open-external",
} as const;

export type CreateClipResult =
  | { ok: true; outputPath: string }
  | { ok: false; error: string };

export type RenameClipResult =
  | { ok: true; clip: ClipRecord }
  | { ok: false; error: string };

export type CutClipResult =
  | { ok: true; clip: ClipRecord }
  | { ok: false; error: string };

export type StorageInfoResult =
  | { ok: true; info: StorageInfo }
  | { ok: false; error: string };

export type ObsScenesResult =
  | { ok: true; scenes: string[]; currentScene: string | null }
  | { ok: false; error: string };

export interface HotkeyClipPayload {
  seconds: number;
  result: CreateClipResult;
  title?: string;
}

export interface ElectronApi {
  getConfig(): Promise<AppConfigDto>;
  saveConfig(config: AppConfigDto): Promise<AppConfigDto>;
  pickOutputDir(): Promise<string | null>;
  getObsStatus(): Promise<ObsStatus>;
  onObsStatus(callback: (status: ObsStatus) => void): () => void;
  getObsScenes(): Promise<ObsScenesResult>;
  createClip(seconds: number): Promise<CreateClipResult>;
  listClips(): Promise<ClipRecord[]>;
  onClipsChanged(callback: (clips: ClipRecord[]) => void): () => void;
  renameClip(id: string, name: string): Promise<RenameClipResult>;
  deleteClip(id: string): Promise<{ ok: boolean; error?: string }>;
  cutClip(
    id: string,
    ranges: CutRange[],
    overwrite?: boolean,
    scale?: ScaleTarget | null,
    name?: string | null,
  ): Promise<CutClipResult>;
  getClip(id: string): Promise<ClipRecord | null>;
  openCutter(id?: string): Promise<{ ok: boolean; error?: string }>;
  onCutterOpenClip(callback: (id: string) => void): () => void;
  openClip(id: string): Promise<{ ok: boolean; error?: string }>;
  revealClip(id: string): Promise<{ ok: boolean; error?: string }>;
  getStorage(): Promise<StorageInfoResult>;
  startObs(): Promise<{ ok: boolean; error?: string }>;
  stopObs(): Promise<{ ok: boolean; error?: string }>;
  onHotkeysFailed(callback: (accelerators: string[]) => void): () => void;
  onHotkeyClip(callback: (payload: HotkeyClipPayload) => void): () => void;
  onQuickActionOpened(callback: () => void): () => void;
  closeQuickAction(): Promise<void>;
  selectQuickAction(seconds: number, title?: string): Promise<void>;
  openExternal(url: string): Promise<{ ok: boolean; error?: string }>;
}

declare global {
  interface Window {
    api: ElectronApi;
  }
}
