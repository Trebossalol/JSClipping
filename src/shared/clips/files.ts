import fs from "node:fs";
import path from "node:path";
import { ensureDir, isVideoFile, yearMonthDir } from "../paths.js";
import { ignorePathTemporarily } from "./ignore.js";

/** Strip Windows-illegal filename characters and trailing dots/spaces. */
export function sanitizeFileStem(name: string): string {
  let stem = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").trim();
  stem = stem.replace(/\.(mp4|mkv|mov|webm|m4v)$/i, "");
  stem = stem.replace(/[. ]+$/g, "");
  return stem;
}

export function uniquePath(dir: string, stem: string, ext: string): string {
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

export function walkVideos(dir: string, out: string[] = []): string[] {
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
