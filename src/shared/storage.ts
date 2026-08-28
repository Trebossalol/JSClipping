import fs from "node:fs";
import path from "node:path";
import type { StorageInfo } from "./ipc.js";

function dirSizeBytes(dir: string): number {
  let total = 0;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        total += dirSizeBytes(full);
      } else if (entry.isFile()) {
        total += fs.statSync(full).size;
      }
    } catch {
      // Skip unreadable entries.
    }
  }
  return total;
}

export async function getStorageInfo(outputDir: string): Promise<StorageInfo> {
  const resolved = path.resolve(outputDir);
  const statPath = fs.existsSync(resolved)
    ? resolved
    : path.parse(resolved).root || resolved;

  let stats: fs.StatsFs;
  try {
    stats = await fs.promises.statfs(statPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Speicherplatz konnte nicht ermittelt werden: ${message}`);
  }

  const bsize = Number(stats.bsize);
  const totalBytes = Number(stats.blocks) * bsize;
  const freeBytes = Number(stats.bavail) * bsize;
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
    throw new Error("Speicherplatz konnte nicht ermittelt werden.");
  }

  const clipsBytes = fs.existsSync(resolved) ? dirSizeBytes(resolved) : 0;

  return {
    outputDir: resolved,
    totalBytes,
    freeBytes: Number.isFinite(freeBytes) ? Math.max(0, freeBytes) : 0,
    clipsBytes,
  };
}
