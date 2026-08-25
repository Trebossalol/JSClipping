import fs from "node:fs";
import path from "node:path";
import { getVideoDuration } from "../clip-service.js";
import type { ClipRecord } from "../ipc.js";
import { ensureDir, isVideoFile } from "../paths.js";
import { generateThumbnail } from "../thumbnail.js";
import { beginImport, endImport, ignorePathTemporarily } from "./ignore.js";
import { moveIntoYearMonth, sanitizeFileStem, uniquePath, walkVideos } from "./files.js";
import {
  listClips,
  newClipId,
  readStore,
  thumbnailsDir,
  writeStore,
} from "./store.js";
import type { ClipsStoreOptions } from "./types.js";

function applyUserFileName(
  filePath: string,
  name: string | undefined,
): { filePath: string; namedByUser: boolean } {
  const requested = name?.trim();
  if (!requested) return { filePath, namedByUser: false };
  const stem = sanitizeFileStem(requested);
  if (!stem) return { filePath, namedByUser: false };
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const dest = uniquePath(dir, stem, ext);
  if (path.normalize(dest) !== path.normalize(filePath)) {
    ignorePathTemporarily(filePath);
    ignorePathTemporarily(dest);
    try {
      fs.renameSync(filePath, dest);
    } catch {
      return { filePath, namedByUser: false };
    }
    return { filePath: dest, namedByUser: true };
  }
  return { filePath, namedByUser: true };
}

export async function importClipFromFile(
  options: ClipsStoreOptions,
  filePath: string,
  opts?: { createdAt?: Date; durationSeconds?: number | null; name?: string },
): Promise<ClipRecord | null> {
  const { appDataDir, outputDir } = options;
  if (!fs.existsSync(filePath) || !isVideoFile(filePath)) return null;

  if (!beginImport(filePath)) return null;

  try {
    const clips = readStore(appDataDir);
    const normalized = path.normalize(filePath);
    if (clips.some((c) => path.normalize(c.filePath) === normalized)) {
      return null;
    }

    const stat = fs.statSync(filePath);
    const createdAt = opts?.createdAt ?? stat.mtime;
    const movedPath = moveIntoYearMonth(filePath, outputDir, createdAt);
    const named = applyUserFileName(movedPath, opts?.name);

    let durationSeconds = opts?.durationSeconds ?? null;
    if (durationSeconds == null) {
      try {
        durationSeconds = await getVideoDuration(named.filePath);
      } catch {
        durationSeconds = null;
      }
    }

    const id = newClipId();
    const thumbnailPath = await generateThumbnail(
      named.filePath,
      thumbnailsDir(appDataDir),
      id,
    );

    const record: ClipRecord = {
      id,
      filePath: named.filePath,
      name: path.basename(named.filePath, path.extname(named.filePath)),
      createdAt: createdAt.toISOString(),
      durationSeconds,
      thumbnailPath,
      missing: false,
      namedByUser: named.namedByUser,
    };

    // Re-read in case another import finished while we were working
    const latest = readStore(appDataDir);
    if (latest.some((c) => path.normalize(c.filePath) === path.normalize(named.filePath))) {
      return null;
    }
    latest.unshift(record);
    writeStore(appDataDir, latest);
    return record;
  } finally {
    endImport(filePath);
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
