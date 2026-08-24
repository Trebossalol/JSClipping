import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const APP_NAME = "JSClipping";

export const MAX_CLIP_SECONDS = 7200;

const WIN_EXE = process.platform === "win32" ? ".exe" : "";

type ElectronProcess = NodeJS.Process & {
  resourcesPath?: string;
  defaultApp?: boolean;
};

function electronProcess(): ElectronProcess {
  return process as ElectronProcess;
}

/** True when running the installed/packaged Electron app (not `electron-vite dev` or tsx). */
export function isPackagedApp(): boolean {
  if (!process.versions.electron) return false;
  if (electronProcess().defaultApp === true) return false;
  if (process.env.ELECTRON_RENDERER_URL) return false;
  return true;
}

/** Installed JSClipping.exe (packaged) or the Electron binary (dev). */
export function getExePath(): string {
  return process.execPath;
}

/**
 * electron-builder extraResources land in `process.resourcesPath`.
 * Unpackaged: `{repo}/resources`.
 */
export function getResourcesDir(): string {
  if (isPackagedApp()) {
    const resourcesPath = electronProcess().resourcesPath;
    if (resourcesPath) return resourcesPath;
  }
  return path.join(getRepoRoot(), "resources");
}

export function getLogsDir(): string {
  if (isPackagedApp()) {
    return path.join(getAppDataDir(), "logs");
  }
  return path.join(getRepoRoot(), "logs");
}

function tryStaticBinary(pkg: string, field?: "path"): string | null {
  try {
    const require = createRequire(import.meta.url);
    const loaded: unknown = require(pkg);
    let candidate: unknown = loaded;
    if (field && loaded && typeof loaded === "object") {
      candidate = (loaded as Record<string, unknown>)[field];
    }
    if (typeof candidate === "string" && candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  } catch {
    // Packaged builds omit these packages; extraResources is used instead.
  }
  return null;
}

function resolveTool(name: "ffmpeg" | "ffprobe"): string {
  const bundled = path.join(getResourcesDir(), "ffmpeg", `${name}${WIN_EXE}`);
  if (fs.existsSync(bundled)) return bundled;

  if (!isPackagedApp()) {
    const staticPkg = name === "ffmpeg" ? "ffmpeg-static" : "ffprobe-static";
    const fromStatic =
      name === "ffmpeg"
        ? tryStaticBinary(staticPkg)
        : tryStaticBinary(staticPkg, "path") ?? tryStaticBinary(staticPkg);
    if (fromStatic) return fromStatic;
  }

  return name;
}

let cachedFfmpeg: string | undefined;
let cachedFfprobe: string | undefined;

export function getFfmpegPath(): string {
  cachedFfmpeg ??= resolveTool("ffmpeg");
  return cachedFfmpeg;
}

export function getFfprobePath(): string {
  cachedFfprobe ??= resolveTool("ffprobe");
  return cachedFfprobe;
}

export function resolveObsExecutable(): string | null {
  const fromEnv = process.env.OBS_PATH?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const programFiles =
    process.env.ProgramFiles ?? "C:\\Program Files";
  const programFilesX86 =
    process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";

  const candidates = [
    path.join(programFiles, "obs-studio", "bin", "64bit", "obs64.exe"),
    path.join(programFilesX86, "obs-studio", "bin", "64bit", "obs64.exe"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function getAutostartBatPath(): string | null {
  const bat = path.join(getRepoRoot(), "scripts", "autostart.bat");
  return fs.existsSync(bat) ? bat : null;
}

/** Parse `--clip 30` or `--clip=30` from argv. Invalid / out of range → null. */
export function parseClipSecondsArg(argv: string[]): number | null {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    let raw: string | undefined;
    if (arg === "--clip") {
      raw = argv[i + 1];
    } else if (arg.startsWith("--clip=")) {
      raw = arg.slice("--clip=".length);
    } else if (arg.startsWith("--clip ")) {
      raw = arg.slice("--clip ".length);
    }
    if (raw == null || raw === "") continue;
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) continue;
    const n = Number.parseInt(trimmed, 10);
    if (n > 0 && n <= MAX_CLIP_SECONDS) return n;
  }
  return null;
}

export function validateClipSeconds(seconds: number): string | null {
  const n = Math.floor(Number(seconds));
  if (!Number.isFinite(n) || n <= 0 || n > MAX_CLIP_SECONDS) {
    return `Clip-Länge muss zwischen 1 und ${MAX_CLIP_SECONDS} Sekunden liegen.`;
  }
  return null;
}

/** Repo root (…/JSClipping). Works for CLI (tsx) and Electron (cwd). */
export function getRepoRoot(): string {
  if (process.env.JSCLIPPING_ROOT) {
    return process.env.JSCLIPPING_ROOT;
  }

  if (isPackagedApp()) {
    return path.dirname(getExePath());
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

export function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
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
