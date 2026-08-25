import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ClipRecord } from "../ipc.js";
import { ensureDir } from "../paths.js";

function clipsJsonPath(appDataDir: string): string {
  return path.join(appDataDir, "clips.json");
}

export function thumbnailsDir(appDataDir: string): string {
  return path.join(appDataDir, "thumbnails");
}

export function readStore(appDataDir: string): ClipRecord[] {
  const file = clipsJsonPath(appDataDir);
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as ClipRecord[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function writeStore(appDataDir: string, clips: ClipRecord[]): void {
  ensureDir(appDataDir);
  fs.writeFileSync(clipsJsonPath(appDataDir), JSON.stringify(clips, null, 2), "utf8");
}

export function newClipId(): string {
  return crypto.randomUUID();
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

function withLiveFileMeta(clip: ClipRecord): ClipRecord {
  try {
    const size = fs.statSync(clip.filePath).size;
    return {
      ...clip,
      namedByUser: resolveNamedByUser(clip),
      missing: false,
      fileSizeBytes: size,
    };
  } catch {
    return {
      ...clip,
      namedByUser: resolveNamedByUser(clip),
      missing: true,
      fileSizeBytes: null,
    };
  }
}

export function listClips(appDataDir: string): ClipRecord[] {
  const clips = readStore(appDataDir).map(withLiveFileMeta);
  clips.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return clips;
}

/** Clips that still need a user title (for tray badge). */
export function countUnnamedClips(appDataDir: string): number {
  return listClips(appDataDir).filter((c) => !c.missing && !c.namedByUser).length;
}

export function findClip(appDataDir: string, id: string): ClipRecord | undefined {
  return listClips(appDataDir).find((c) => c.id === id);
}

export function unlinkThumbnail(appDataDir: string, id: string): void {
  const thumb = path.join(thumbnailsDir(appDataDir), `${id}.jpg`);
  if (fs.existsSync(thumb)) {
    try {
      fs.unlinkSync(thumb);
    } catch {
      // Thumbnail cleanup is best-effort.
    }
  }
}
