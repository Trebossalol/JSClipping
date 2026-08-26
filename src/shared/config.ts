import fs from "node:fs";
import path from "node:path";
import * as z from "zod";
import { DEFAULT_USER_CONFIG, MAX_CLIP_PRESETS } from "./app.config.js";
import { normalizeHotkey } from "./hotkeys.js";
import { normalizeClipPresets } from "./ipc.js";
import { ensureDir, getAppDataDir } from "./paths.js";

export const ConfigSchema = z.object({
  OBS_URL: z.url(),
  OBS_PASSWORD: z.string().min(1),
  CLIP_OUTPUT_DIR: z.string().min(1),
  AUTOSTART: z.boolean().default(false),
  QUICK_ACTION_HOTKEY: z.preprocess(
    (value) => (typeof value === "string" ? normalizeHotkey(value) : null),
    z.string().nullable(),
  ),
  CLIP_PRESETS: z.preprocess(
    (value) => normalizeClipPresets(value),
    z
      .array(
        z.object({
          seconds: z.number().int(),
          hotkey: z.string().nullable(),
        }),
      )
      .min(1)
      .max(MAX_CLIP_PRESETS),
  ),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

const DEFAULTS: AppConfig = {
  ...DEFAULT_USER_CONFIG,
  CLIP_PRESETS: DEFAULT_USER_CONFIG.CLIP_PRESETS.map((preset) => ({
    ...preset,
  })),
};

let cachedAppDataDir: string | undefined;

export function setAppDataDir(dir: string): void {
  cachedAppDataDir = dir;
}

export function resolveAppDataDir(electronUserData?: string): string {
  if (cachedAppDataDir) return cachedAppDataDir;
  return getAppDataDir(electronUserData);
}

export function configPath(appDataDir?: string): string {
  return path.join(appDataDir ?? resolveAppDataDir(), "config.json");
}

export function loadConfig(appDataDir?: string): AppConfig {
  const dir = appDataDir ?? resolveAppDataDir();
  ensureDir(dir);
  const file = configPath(dir);

  if (fs.existsSync(file)) {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return ConfigSchema.parse({ ...DEFAULTS, ...raw });
    }
    return ConfigSchema.parse(raw);
  }

  const config = { ...DEFAULTS };
  saveConfig(config, dir);
  return config;
}

export function saveConfig(config: AppConfig, appDataDir?: string): AppConfig {
  const dir = appDataDir ?? resolveAppDataDir();
  ensureDir(dir);
  const validated = ConfigSchema.parse(config);
  fs.writeFileSync(configPath(dir), JSON.stringify(validated, null, 2), "utf8");
  return validated;
}

export function updateConfig(
  partial: Partial<AppConfig>,
  appDataDir?: string,
): AppConfig {
  const current = loadConfig(appDataDir);
  return saveConfig({ ...current, ...partial }, appDataDir);
}
