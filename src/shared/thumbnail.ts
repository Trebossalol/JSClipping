import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { ensureDir, getFfmpegPath } from "./paths.js";

const execFileAsync = promisify(execFile);

export async function generateThumbnail(
  videoPath: string,
  thumbnailsDir: string,
  id: string,
): Promise<string | null> {
  ensureDir(thumbnailsDir);
  const outPath = path.join(thumbnailsDir, `${id}.jpg`);

  try {
    await execFileAsync(
      getFfmpegPath(),
      ["-y", "-ss", "1", "-i", videoPath, "-frames:v", "1", "-q:v", "4", outPath],
      { windowsHide: true },
    );
    if (fs.existsSync(outPath)) {
      return outPath;
    }
  } catch {
    // Fall through — try frame at 0s
  }

  try {
    await execFileAsync(
      getFfmpegPath(),
      ["-y", "-i", videoPath, "-frames:v", "1", "-q:v", "4", outPath],
      { windowsHide: true },
    );
    return fs.existsSync(outPath) ? outPath : null;
  } catch {
    return null;
  }
}
