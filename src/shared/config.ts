import fs from "node:fs";
import path from "node:path";
import * as z from "zod";
import { ensureDir, getAppDataDir, getRepoRoot } from "./paths.js";

export const ConfigSchema = z.object({
  OBS_URL: z.url(),
  OBS_PASSWORD: z.string().min(1),
  CLIP_OUTPUT_DIR: z.string().min(1),
  AUTOSTART: z.boolean().default(false),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

const DEFAULTS: AppConfig = {
  OBS_URL: "ws://localhost:4455",
  OBS_PASSWORD: "CHANGE_ME",
  CLIP_OUTPUT_DIR: "C:\\Clips",
  AUTOSTART: false,
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

function parseDotEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function tryLoadEnvFile(): AppConfig | null {
  const envPath = path.join(getRepoRoot(), ".env");
  if (!fs.existsSync(envPath)) return null;
  try {
    const parsed = parseDotEnv(fs.readFileSync(envPath, "utf8"));
    const candidate = {
      OBS_URL: parsed.OBS_URL,
      OBS_PASSWORD: parsed.OBS_PASSWORD,
      CLIP_OUTPUT_DIR: parsed.CLIP_OUTPUT_DIR,
      AUTOSTART: parsed.AUTOSTART === "true",
    };
    const result = ConfigSchema.safeParse(candidate);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
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

  const fromEnv = tryLoadEnvFile();
  const config = fromEnv ?? { ...DEFAULTS };
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
