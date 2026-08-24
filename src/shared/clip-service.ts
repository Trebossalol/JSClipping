import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { OBSWebSocket } from "obs-websocket-js";
import { MIN_CUT_RANGE_SECONDS, type CutRange } from "./ipc.js";
import type { RunLog } from "./log.js";
import { ensureDir, getFfmpegPath, getFfprobePath, yearMonthDir } from "./paths.js";

const execFileAsync = promisify(execFile);

const FFMPEG_OPTS = { maxBuffer: 10 * 1024 * 1024, windowsHide: true } as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Best-effort delete of the full OBS replay after a successful trim. */
async function deleteReplaySource(filePath: string, log?: RunLog): Promise<void> {
  const attempts = 3;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      await sleep(250 * 2 ** (i - 1));
    }
    try {
      if (!fs.existsSync(filePath)) {
        log?.info(`Source replay already gone: ${filePath}`);
        return;
      }
      fs.unlinkSync(filePath);
      log?.info(`Deleted source replay: ${filePath}`);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log?.info(
        `Could not delete source replay (attempt ${i + 1}/${attempts}): ${message}`,
      );
    }
  }
  log?.info(`Left source replay on disk: ${filePath}`);
}

function fileSize(filePath: string): number | null {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return null;
  }
}

function ffmpegMessage(err: unknown): string {
  if (err && typeof err === "object" && "stderr" in err) {
    const stderr = String((err as { stderr: unknown }).stderr).trim();
    if (stderr) {
      const lines = stderr.split(/\r?\n/).filter(Boolean);
      return lines.slice(-6).join("\n") || stderr;
    }
  }
  return err instanceof Error ? err.message : String(err);
}

export async function getVideoDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync(
    getFfprobePath(),
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ],
    FFMPEG_OPTS,
  );
  const duration = parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Die Clip-Dauer konnte nicht ermittelt werden.");
  }
  return duration;
}

export function normalizeCutRanges(
  ranges: CutRange[],
  duration: number,
): CutRange[] {
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Die Clip-Dauer konnte nicht ermittelt werden.");
  }
  if (!ranges.length) {
    throw new Error("Mindestens ein Bereich muss ausgewählt werden.");
  }

  const cleaned = ranges.map((range, index) => {
    const start = Number(range.start);
    const end = Number(range.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      throw new Error(`Bereich ${index + 1} hat ungültige Zeiten.`);
    }
    if (start < 0 || end > duration + 0.05) {
      throw new Error(`Bereich ${index + 1} liegt außerhalb der Clip-Dauer.`);
    }
    if (end - start < MIN_CUT_RANGE_SECONDS) {
      throw new Error(
        `Bereich ${index + 1} ist zu kurz (mindestens ${MIN_CUT_RANGE_SECONDS}s).`,
      );
    }
    return {
      start: Math.max(0, start),
      end: Math.min(duration, end),
    };
  });

  cleaned.sort((a, b) => a.start - b.start);

  for (let i = 1; i < cleaned.length; i++) {
    const prev = cleaned[i - 1]!;
    const next = cleaned[i]!;
    if (next.start < prev.end - 0.01) {
      throw new Error("Bereiche dürfen sich nicht überschneiden.");
    }
  }

  return cleaned;
}

async function runFfmpeg(args: string[], log?: RunLog): Promise<void> {
  log?.info(`ffmpeg ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`);
  try {
    const { stdout, stderr } = await execFileAsync(getFfmpegPath(), args, FFMPEG_OPTS);
    if (stdout.trim()) {
      log?.info(`ffmpeg stdout:\n${stdout.trim()}`);
    }
    if (stderr.trim()) {
      log?.info(`ffmpeg stderr:\n${stderr.trim()}`);
    }
  } catch (err) {
    throw new Error(ffmpegMessage(err));
  }
}

async function extractRange(
  src: string,
  dst: string,
  start: number,
  duration: number,
  log?: RunLog,
): Promise<void> {
  await runFfmpeg(
    [
      "-y",
      "-ss",
      String(start),
      "-i",
      src,
      "-t",
      String(duration),
      "-c",
      "copy",
      "-avoid_negative_ts",
      "make_zero",
      dst,
    ],
    log,
  );
}

function concatListLine(filePath: string): string {
  const posix = filePath.replace(/\\/g, "/").replace(/'/g, "'\\''");
  return `file '${posix}'`;
}

async function concatSegments(
  files: string[],
  dst: string,
  log?: RunLog,
): Promise<void> {
  const listPath = path.join(path.dirname(files[0]!), "concat.txt");
  fs.writeFileSync(listPath, files.map(concatListLine).join("\n"), "utf8");
  await runFfmpeg(
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      "-avoid_negative_ts",
      "make_zero",
      dst,
    ],
    log,
  );
}

export async function cutVideoToFile(
  src: string,
  dst: string,
  ranges: CutRange[],
  log?: RunLog,
): Promise<{ durationSeconds: number }> {
  if (!fs.existsSync(src)) {
    throw new Error("Die Clip-Datei fehlt.");
  }

  const total = await getVideoDuration(src);
  const normalized = normalizeCutRanges(ranges, total);
  log?.info(`Source duration: ${total}s`);
  log?.info(
    `Keeping ${normalized.length} range(s): ${normalized
      .map((r) => `${r.start.toFixed(2)}–${r.end.toFixed(2)}`)
      .join(", ")}`,
  );

  ensureDir(path.dirname(dst));

  if (normalized.length === 1) {
    const range = normalized[0]!;
    await extractRange(src, dst, range.start, range.end - range.start, log);
  } else {
    const tmp = path.join(os.tmpdir(), `jsclipping-cut-${crypto.randomUUID()}`);
    ensureDir(tmp);
    try {
      const ext = path.extname(src) || ".mp4";
      const parts: string[] = [];
      for (let i = 0; i < normalized.length; i++) {
        const range = normalized[i]!;
        const part = path.join(tmp, `seg-${i}${ext}`);
        await extractRange(src, part, range.start, range.end - range.start, log);
        parts.push(part);
      }
      await concatSegments(parts, dst, log);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  const durationSeconds = await getVideoDuration(dst);
  log?.info(`Output file: ${dst} (${fileSize(dst)} bytes)`);
  log?.info(`Output duration: ${durationSeconds}s`);
  return { durationSeconds };
}

export interface SaveAndTrimOptions {
  obs: OBSWebSocket;
  seconds: number;
  outputDir: string;
  log?: RunLog;
  /** Timestamp used for YYYY/MM folder; defaults to now. */
  createdAt?: Date;
  /** Called as soon as OBS reports the saved replay path (before trim). */
  onReplaySaved?: (savedPath: string) => void;
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
    throw new Error("Der Speicherpfad der Wiederholungspuffer-Datei konnte nicht ermittelt werden.");
  }

  log?.info(`Replay file: ${savedPath} (${fileSize(savedPath)} bytes)`);
  options.onReplaySaved?.(savedPath);

  const monthDir = yearMonthDir(outputDir, createdAt);
  ensureDir(monthDir);

  const ext = path.extname(savedPath);
  const base = path.basename(savedPath, ext);
  const dst = path.join(monthDir, `${base}_${seconds}s${ext}`);

  const total = await getVideoDuration(savedPath);
  const start = Math.max(0, total - seconds);
  log?.info(`Replay duration: ${total}s`);
  log?.info(`Trim start: ${start}s (keeping last ${seconds}s)`);

  const { durationSeconds } = await cutVideoToFile(
    savedPath,
    dst,
    [{ start, end: total }],
    log,
  );

  log?.info(`Saved ${seconds}s clip: ${dst}`);

  if (path.normalize(savedPath).toLowerCase() !== path.normalize(dst).toLowerCase()) {
    await deleteReplaySource(savedPath, log);
  }

  return {
    outputPath: dst,
    sourcePath: savedPath,
    durationSeconds,
  };
}
