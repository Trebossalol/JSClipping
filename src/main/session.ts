import {
  loadConfig,
  saveConfig,
  setAppDataDir,
  type AppConfig,
} from "../shared/config.js";

/**
 * Process-wide app data dir and loaded config.
 * Initialized once in `app.whenReady` via `initSession`.
 */
let appDataDir = "";
let config!: AppConfig;

export function initSession(dir: string): AppConfig {
  appDataDir = dir;
  setAppDataDir(dir);
  config = loadConfig(dir);
  return config;
}

export function getAppDataDir(): string {
  return appDataDir;
}

export function getConfig(): AppConfig {
  return config;
}

export function persistConfig(next: AppConfig): AppConfig {
  config = saveConfig(next, appDataDir);
  return config;
}
