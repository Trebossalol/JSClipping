export const DEFAULT_CLIP_PRESETS = [30, 60, 300, 600] as const;
export const MIN_CLIP_PRESET_SECONDS = 1;
export const MAX_CLIP_PRESET_SECONDS = 7200;
export const MAX_CLIP_PRESETS = 12;

export function normalizeClipPresets(value: unknown): number[] {
  if (!Array.isArray(value)) return [...DEFAULT_CLIP_PRESETS];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const item of value) {
    const n = typeof item === "number" ? item : Number(item);
    if (!Number.isInteger(n)) continue;
    if (n < MIN_CLIP_PRESET_SECONDS || n > MAX_CLIP_PRESET_SECONDS) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= MAX_CLIP_PRESETS) break;
  }
  return out.length > 0 ? out : [...DEFAULT_CLIP_PRESETS];
}

export interface AppConfigDto {
  OBS_URL: string;
  OBS_PASSWORD: string;
  CLIP_OUTPUT_DIR: string;
  AUTOSTART: boolean;
  CLIP_PRESETS: number[];
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
}

export interface ClipRecord {
  id: string;
  filePath: string;
  name: string;
  createdAt: string;
  durationSeconds: number | null;
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

export const MIN_CUT_RANGE_SECONDS = 0.2;

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
  createClip: "clip:create",
  listClips: "clips:list",
  clipsChanged: "clips:changed",
  renameClip: "clips:rename",
  deleteClip: "clips:delete",
  cutClip: "clips:cut",
  getClip: "clips:get",
  openCutter: "clips:open-cutter",
  openClip: "clips:open",
  revealClip: "clips:reveal",
  getStorage: "storage:get",
  startObs: "obs:start",
  stopObs: "obs:stop",
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

export interface ElectronApi {
  getConfig(): Promise<AppConfigDto>;
  saveConfig(config: AppConfigDto): Promise<AppConfigDto>;
  pickOutputDir(): Promise<string | null>;
  getObsStatus(): Promise<ObsStatus>;
  onObsStatus(callback: (status: ObsStatus) => void): () => void;
  createClip(seconds: number): Promise<CreateClipResult>;
  listClips(): Promise<ClipRecord[]>;
  onClipsChanged(callback: (clips: ClipRecord[]) => void): () => void;
  renameClip(id: string, name: string): Promise<RenameClipResult>;
  deleteClip(id: string): Promise<{ ok: boolean; error?: string }>;
  cutClip(id: string, ranges: CutRange[]): Promise<CutClipResult>;
  getClip(id: string): Promise<ClipRecord | null>;
  openCutter(id: string): Promise<{ ok: boolean; error?: string }>;
  openClip(id: string): Promise<{ ok: boolean; error?: string }>;
  revealClip(id: string): Promise<{ ok: boolean; error?: string }>;
  getStorage(): Promise<StorageInfoResult>;
  startObs(): Promise<{ ok: boolean; error?: string }>;
  stopObs(): Promise<{ ok: boolean; error?: string }>;
}

declare global {
  interface Window {
    api: ElectronApi;
  }
}
