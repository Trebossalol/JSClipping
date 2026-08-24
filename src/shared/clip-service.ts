import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { OBSWebSocket } from "obs-websocket-js";
import type { RunLog } from "./log.js";
import { ensureDir, yearMonthDir } from "./paths.js";

const execFileAsync = promisify(execFile);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fileSize(filePath: string): number | null {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return null;
  }
}

export async function getVideoDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  return parseFloat(stdout.trim());
}

async function trimLastNSeconds(
  src: string,
  dst: string,
  seconds: number,
  log?: RunLog,
): Promise<{ total: number; start: number }> {
  const total = await getVideoDuration(src);
  const start = Math.max(0, total - seconds);

  log?.info(`Replay duration: ${total}s`);
  log?.info(`Trim start: ${start}s (keeping last ${seconds}s)`);
  log?.info(`ffmpeg -y -ss ${start} -i "${src}" -c copy "${dst}"`);

  const { stdout, stderr } = await execFileAsync("ffmpeg", [
    "-y",
    "-ss",
    String(start),
    "-i",
    src,
    "-c",
    "copy",
    dst,
  ]);

  if (stdout.trim()) {
    log?.info(`ffmpeg stdout:\n${stdout.trim()}`);
  }
  if (stderr.trim()) {
    log?.info(`ffmpeg stderr:\n${stderr.trim()}`);
  }

  return { total, start };
}

export interface SaveAndTrimOptions {
  obs: OBSWebSocket;
  seconds: number;
  outputDir: string;
  log?: RunLog;
  /** Timestamp used for YYYY/MM folder; defaults to now. */
  createdAt?: Date;
}

export interface SaveAndTrimResult {
  outputPath: string;
  sourcePath: string;
  durationSeconds: number;
}

export async function saveAndTrimClip(
  options: SaveAndTrimOptions,
): Promise<SaveAndTrimResult> {
  const { obs, seconds, outputDir, log } = options;
  const createdAt = options.createdAt ?? new Date();

  await obs.call("SaveReplayBuffer");
  log?.info("SaveReplayBuffer requested");

  let savedPath: string | null = null;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      const status = await obs.call("GetLastReplayBufferReplay");
      log?.info(`Poll ${i + 1}/20: ${status.savedReplayPath || "(no path yet)"}`);
      if (status.savedReplayPath && fs.existsSync(status.savedReplayPath)) {
        savedPath = status.savedReplayPath;
        break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log?.info(`Poll ${i + 1}/20: not ready (${message})`);
    }
  }

  if (!savedPath) {
    throw new Error("Could not determine saved replay buffer file path.");
  }

  log?.info(`Replay file: ${savedPath} (${fileSize(savedPath)} bytes)`);

  const monthDir = yearMonthDir(outputDir, createdAt);
  ensureDir(monthDir);

  const ext = path.extname(savedPath);
  const base = path.basename(savedPath, ext);
  const dst = path.join(monthDir, `${base}_${seconds}s${ext}`);

  await trimLastNSeconds(savedPath, dst, seconds, log);

  const outputDuration = await getVideoDuration(dst);
  log?.info(`Output file: ${dst} (${fileSize(dst)} bytes)`);
  log?.info(`Output duration: ${outputDuration}s`);
  log?.info(`Saved ${seconds}s clip: ${dst}`);

  return {
    outputPath: dst,
    sourcePath: savedPath,
    durationSeconds: outputDuration,
  };
}
