/** Compile-time app identity and defaults. User settings live in AppData (`config.ts`). */

/** Display name (UI, tray, window title, shortcuts). */
export const APP_NAME = "Easy Clip";

/** Product id (exe, AppData folder, installer artifacts). */
export const APP_ID = "EasyClip";

export const APP_USER_MODEL_ID = "com.easyclip.app";

export const MIN_CLIP_PRESET_SECONDS = 5;
export const MAX_CLIP_PRESETS = 6;
export const DEFAULT_CLIP_PRESETS = [30, 60, 300, 600] as const;

export const MIN_CUT_RANGE_SECONDS = 0.2;

export const DEFAULT_USER_CONFIG = {
  OBS_URL: "ws://localhost:4455",
  OBS_PASSWORD: "CHANGE_ME",
  CLIP_OUTPUT_DIR: "C:\\Clips",
  AUTOSTART: false,
  CLIP_PRESETS: DEFAULT_CLIP_PRESETS.map((seconds) => ({
    seconds,
    hotkey: null as string | null,
  })),
  ONBOARDING_HIDDEN: false,
};
