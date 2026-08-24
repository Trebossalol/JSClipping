import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getVideoDuration } from "./clip-service.js";
import type { ClipRecord } from "./ipc.js";
import { ensureDir, isVideoFile, yearMonthDir, yearMonthParts } from "./paths.js";
import { generateThumbnail } from "./thumbnail.js";

export interface ClipsStoreOptions {
  appDataDir: string;
  outputDir: string;
}

/** Paths we renamed ourselves — watcher should ignore these. */
const ignoredPaths = new Set<string>();
const importingPaths = new Set<string>();

export function ignorePathTemporarily(filePath: string, ms = 5000): void {
  const key = path.normalize(filePath).toLowerCase();
  ignoredPaths.add(key);
  setTimeout(() => ignoredPaths.delete(key), ms);
}

export function isIgnoredPath(filePath: string): boolean {
  return ignoredPaths.has(path.normalize(filePath).toLowerCase());
}

function clipsJsonPath(appDataDir: string): string {
  return path.join(appDataDir, "clips.json");
}

function thumbnailsDir(appDataDir: string): string {
  return path.join(appDataDir, "thumbnails");
}

function readStore(appDataDir: string): ClipRecord[] {
  const file = clipsJsonPath(appDataDir);
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as ClipRecord[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeStore(appDataDir: string, clips: ClipRecord[]): void {
  ensureDir(appDataDir);
  fs.writeFileSync(clipsJsonPath(appDataDir), JSON.stringify(clips, null, 2), "utf8");
}

export function listClips(appDataDir: string): ClipRecord[] {
  const clips = readStore(appDataDir).map((clip) => ({
    ...clip,
    namedByUser: resolveNamedByUser(clip),
    missing: !fs.existsSync(clip.filePath),
  }));
  clips.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return clips;
}

/** Default OBS/CLI filenames still count as unnamed until the user renames. */
function looksAutoNamed(name: string): boolean {
  return /_\d+s$/i.test(name) || /^Replay\b/i.test(name);
}

function resolveNamedByUser(clip: ClipRecord): boolean {
  if (clip.namedByUser === true) return true;
  if (clip.namedByUser === false) return false;
  // Legacy rows without the flag: treat non-auto names as already titled.
  return !looksAutoNamed(clip.name);
}

/** Clips that still need a user title (for tray badge). */
export function countUnnamedClips(appDataDir: string): number {
  return listClips(appDataDir).filter((c) => !c.missing && !c.namedByUser).length;
}

function newId(): string {
  return crypto.randomUUID();
}

/** Strip Windows-illegal filename characters and trailing dots/spaces. */
export function sanitizeFileStem(name: string): string {
  let stem = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").trim();
  stem = stem.replace(/\.(mp4|mkv|mov|webm|m4v)$/i, "");
  stem = stem.replace(/[. ]+$/g, "");
  return stem;
}

function uniquePath(dir: string, stem: string, ext: string): string {
  let candidate = path.join(dir, `${stem}${ext}`);
  if (!fs.existsSync(candidate)) return candidate;

  for (let n = 2; n < 10_000; n++) {
    candidate = path.join(dir, `${stem} (${n})${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  return path.join(dir, `${stem}-${Date.now()}${ext}`);
}

function alreadyUnderYearMonth(filePath: string, outputDir: string): boolean {
  const rel = path.relative(outputDir, path.dirname(filePath));
  if (rel.startsWith("..") || path.isAbsolute(rel)) return false;
  const parts = rel.split(path.sep).filter(Boolean);
  if (parts.length < 2) return false;
  return /^\d{4}$/.test(parts[0]!) && /^\d{2}$/.test(parts[1]!);
}

export function moveIntoYearMonth(
  filePath: string,
  outputDir: string,
  date: Date,
): string {
  if (alreadyUnderYearMonth(filePath, outputDir)) {
    return filePath;
  }

  const destDir = yearMonthDir(outputDir, date);
  ensureDir(destDir);
  const dest = uniquePath(
    destDir,
    path.basename(filePath, path.extname(filePath)),
    path.extname(filePath),
  );

  if (path.normalize(filePath) === path.normalize(dest)) {
    return filePath;
  }

  ignorePathTemporarily(filePath);
  ignorePathTemporarily(dest);
  fs.renameSync(filePath, dest);
  return dest;
}

function walkVideos(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkVideos(full, out);
    } else if (entry.isFile() && isVideoFile(full)) {
      out.push(full);
    }
  }
  return out;
}

export async function importClipFromFile(
  options: ClipsStoreOptions,
  filePath: string,
  opts?: { createdAt?: Date; durationSeconds?: number | null },
): Promise<ClipRecord | null> {
  const { appDataDir, outputDir } = options;
  if (!fs.existsSync(filePath) || !isVideoFile(filePath)) return null;

  const importKey = path.normalize(filePath).toLowerCase();
  if (importingPaths.has(importKey)) return null;
  importingPaths.add(importKey);

  try {
    const clips = readStore(appDataDir);
    const normalized = path.normalize(filePath);
    if (clips.some((c) => path.normalize(c.filePath) === normalized)) {
      return null;
    }

    const stat = fs.statSync(filePath);
    const createdAt = opts?.createdAt ?? stat.mtime;
    const movedPath = moveIntoYearMonth(filePath, outputDir, createdAt);

    let durationSeconds = opts?.durationSeconds ?? null;
    if (durationSeconds == null) {
      try {
        durationSeconds = await getVideoDuration(movedPath);
      } catch {
        durationSeconds = null;
      }
    }

    const id = newId();
    const thumbnailPath = await generateThumbnail(
      movedPath,
      thumbnailsDir(appDataDir),
      id,
    );

    const record: ClipRecord = {
      id,
      filePath: movedPath,
      name: path.basename(movedPath, path.extname(movedPath)),
      createdAt: createdAt.toISOString(),
      durationSeconds,
      thumbnailPath,
      missing: false,
      namedByUser: false,
    };

    // Re-read in case another import finished while we were working
    const latest = readStore(appDataDir);
    if (latest.some((c) => path.normalize(c.filePath) === path.normalize(movedPath))) {
      return null;
    }
    latest.unshift(record);
    writeStore(appDataDir, latest);
    return record;
  } finally {
    importingPaths.delete(importKey);
  }
}

export async function scanAndImportExisting(
  options: ClipsStoreOptions,
): Promise<ClipRecord[]> {
  const { appDataDir, outputDir } = options;
  ensureDir(outputDir);
  const existing = readStore(appDataDir);
  const known = new Set(existing.map((c) => path.normalize(c.filePath).toLowerCase()));
  const files = walkVideos(outputDir);
  const added: ClipRecord[] = [];

  for (const file of files) {
    if (known.has(path.normalize(file).toLowerCase())) continue;
    // Skip if already indexed under a previous path that moved — check basename+size lightly via known after move
    const record = await importClipFromFile(options, file);
    if (record) {
      added.push(record);
      known.add(path.normalize(record.filePath).toLowerCase());
    }
  }

  // Refresh missing flags and persist year/month moves for already-indexed clips
  const clips = readStore(appDataDir);
  let changed = false;
  for (const clip of clips) {
    if (!fs.existsSync(clip.filePath)) {
      if (!clip.missing) {
        clip.missing = true;
        changed = true;
      }
      continue;
    }
    const date = new Date(clip.createdAt);
    const moved = moveIntoYearMonth(clip.filePath, outputDir, date);
    if (moved !== clip.filePath) {
      clip.filePath = moved;
      clip.missing = false;
      changed = true;
    }
  }
  if (changed) writeStore(appDataDir, clips);

  return listClips(appDataDir);
}

export function renameClip(
  appDataDir: string,
  id: string,
  newName: string,
): { ok: true; clip: ClipRecord } | { ok: false; error: string } {
  const clips = readStore(appDataDir);
  const index = clips.findIndex((c) => c.id === id);
  if (index < 0) return { ok: false, error: "Clip not found." };

  const clip = clips[index]!;
  const stem = sanitizeFileStem(newName);
  if (!stem) {
    return { ok: false, error: "Name is empty after removing invalid characters." };
  }

  if (!fs.existsSync(clip.filePath)) {
    clip.name = stem;
    clip.namedByUser = true;
    clip.missing = true;
    writeStore(appDataDir, clips);
    return { ok: true, clip: { ...clip } };
  }

  const dir = path.dirname(clip.filePath);
  const ext = path.extname(clip.filePath);
  const currentStem = path.basename(clip.filePath, ext);

  if (stem === currentStem) {
    clip.name = stem;
    clip.namedByUser = true;
    writeStore(appDataDir, clips);
    return { ok: true, clip: { ...clip, missing: false } };
  }

  const dest = uniquePath(dir, stem, ext);
  ignorePathTemporarily(clip.filePath);
  ignorePathTemporarily(dest);

  try {
    fs.renameSync(clip.filePath, dest);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Could not rename file: ${message}` };
  }

  clip.filePath = dest;
  clip.name = path.basename(dest, ext);
  clip.namedByUser = true;
  clip.missing = false;
  writeStore(appDataDir, clips);
  return { ok: true, clip: { ...clip } };
}

export function findClip(appDataDir: string, id: string): ClipRecord | undefined {
  return listClips(appDataDir).find((c) => c.id === id);
}

export function waitForStableFile(
  filePath: string,
  opts?: { checks?: number; intervalMs?: number },
): Promise<boolean> {
  const checks = opts?.checks ?? 4;
  const intervalMs = opts?.intervalMs ?? 400;

  return new Promise((resolve) => {
    let lastSize = -1;
    let stableCount = 0;
    let attempts = 0;
    const maxAttempts = 40;

    const tick = (): void => {
      attempts += 1;
      try {
        const size = fs.statSync(filePath).size;
        if (size > 0 && size === lastSize) {
          stableCount += 1;
          if (stableCount >= checks) {
            resolve(true);
            return;
          }
        } else {
          stableCount = 0;
          lastSize = size;
        }
      } catch {
        stableCount = 0;
      }
      if (attempts >= maxAttempts) {
        resolve(fs.existsSync(filePath));
        return;
      }
      setTimeout(tick, intervalMs);
    };

    tick();
  });
}

export { yearMonthParts, thumbnailsDir };
