export interface AppConfigDto {
  OBS_URL: string;
  OBS_PASSWORD: string;
  CLIP_OUTPUT_DIR: string;
}

export interface ObsStatus {
  connected: boolean;
  error?: string;
}

export interface ClipRecord {
  id: string;
  filePath: string;
  name: string;
  createdAt: string;
  durationSeconds: number | null;
  thumbnailPath: string | null;
  missing?: boolean;
  /** True once the user has set a custom title in the app. */
  namedByUser?: boolean;
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
  openClip: "clips:open",
  revealClip: "clips:reveal",
} as const;

export type CreateClipResult =
  | { ok: true; outputPath: string }
  | { ok: false; error: string };

export type RenameClipResult =
  | { ok: true; clip: ClipRecord }
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
  openClip(id: string): Promise<{ ok: boolean; error?: string }>;
  revealClip(id: string): Promise<{ ok: boolean; error?: string }>;
}

declare global {
  interface Window {
    api: ElectronApi;
  }
}
