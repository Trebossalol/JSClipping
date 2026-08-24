import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const APP_NAME = "JSClipping";

/** Repo root (…/JSClipping). Works for CLI (tsx) and Electron (cwd). */
export function getRepoRoot(): string {
  if (process.env.JSCLIPPING_ROOT) {
    return process.env.JSCLIPPING_ROOT;
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const normalized = here.replace(/\\/g, "/");
  if (normalized.endsWith("/src/shared") || normalized.endsWith("/shared")) {
    // src/shared -> repo root, or out/.../shared if copied
    const candidate = path.resolve(here, "..", "..");
    if (fs.existsSync(path.join(candidate, "package.json"))) {
      return candidate;
    }
  }

  // electron-vite / npm scripts: cwd is the project root
  return process.cwd();
}

/**
 * App data directory for config, clips index, and thumbnails.
 * Prefer APPDATA on Windows so CLI and Electron share the same files.
 */
export function getAppDataDir(electronUserData?: string): string {
  if (process.env.APPDATA) {
    return path.join(process.env.APPDATA, APP_NAME);
  }
  if (electronUserData) {
    return electronUserData;
  }
  return path.join(process.env.HOME ?? process.cwd(), `.${APP_NAME}`);
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function yearMonthParts(date: Date = new Date()): { year: string; month: string } {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return { year, month };
}

/** `{outputDir}/{YYYY}/{MM}` */
export function yearMonthDir(outputDir: string, date: Date = new Date()): string {
  const { year, month } = yearMonthParts(date);
  return path.join(outputDir, year, month);
}

const VIDEO_EXTS = new Set([".mp4", ".mkv", ".mov", ".webm", ".m4v"]);

export function isVideoFile(filePath: string): boolean {
  return VIDEO_EXTS.has(path.extname(filePath).toLowerCase());
}
