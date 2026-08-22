#!/usr/bin/env node
/**
 * obs_replay_clip.js
 *
 * Triggers OBS's Replay Buffer save via obs-websocket (OBS 28+ built-in
 * WebSocket v5), then trims the resulting file down to the last N seconds
 * using ffmpeg. Meant to be called from a shortcut/.bat tied to a Logitech
 * Action Ring segment:
 *
 *   node obs_replay_clip.js 30    -> saves a 30 second clip
 *   node obs_replay_clip.js 60    -> saves a 60 second clip
 *   node obs_replay_clip.js 300   -> saves a 5 minute clip
 *   node obs_replay_clip.js 600   -> saves the full 10 minute buffer
 *
 * Requires: npm install obs-websocket-js
 * Requires: ffmpeg + ffprobe on PATH
 * Requires: OBS WebSocket server enabled (Tools -> WebSocket Server Settings)
 */

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { OBSWebSocket } from "obs-websocket-js";
import { env } from "./env.js";
import { createRunLog } from "./log.js";

const execFileAsync = promisify(execFile);

const OBS_URL = env.OBS_URL;
const OBS_PASSWORD = env.OBS_PASSWORD;
const CLIP_OUTPUT_DIR = env.CLIP_OUTPUT_DIR;

const log = createRunLog("clip");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return null;
  }
}

async function getVideoDuration(filePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  return parseFloat(stdout.trim());
}

async function trimLastNSeconds(src, dst, seconds) {
  const total = await getVideoDuration(src);
  const start = Math.max(0, total - seconds);

  log.info(`Replay duration: ${total}s`);
  log.info(`Trim start: ${start}s (keeping last ${seconds}s)`);
  log.info(`ffmpeg -y -ss ${start} -i "${src}" -c copy "${dst}"`);

  const { stdout, stderr } = await execFileAsync("ffmpeg", [
    "-y",
    "-ss", String(start),
    "-i", src,
    "-c", "copy",
    dst,
  ]);

  if (stdout.trim()) {
    log.info(`ffmpeg stdout:\n${stdout.trim()}`);
  }
  if (stderr.trim()) {
    log.info(`ffmpeg stderr:\n${stderr.trim()}`);
  }

  return { total, start };
}

async function main() {
  log.info(`Log file: ${log.filePath}`);
  log.info(`Requested clip length: ${process.argv[2] ?? "(none)"}s`);
  log.info(`OBS_URL: ${OBS_URL}`);
  log.info(`CLIP_OUTPUT_DIR: ${CLIP_OUTPUT_DIR}`);

  const seconds = parseInt(process.argv[2], 10);
  if (!seconds || Number.isNaN(seconds)) {
    log.error("Usage: node obs_replay_clip.js <seconds>");
    process.exit(1);
  }

  if (!fs.existsSync(CLIP_OUTPUT_DIR)) {
    fs.mkdirSync(CLIP_OUTPUT_DIR, { recursive: true });
    log.info(`Created output directory: ${CLIP_OUTPUT_DIR}`);
  }

  const obs = new OBSWebSocket();

  try {
    await obs.connect(OBS_URL, OBS_PASSWORD);
    log.info("Connected to OBS WebSocket");
  } catch (err) {
    log.error(`Could not connect to OBS WebSocket: ${err.message}`);
    process.exit(1);
  }

  try {
    await obs.call("SaveReplayBuffer");
    log.info("SaveReplayBuffer requested");

    // OBS needs a moment to flush the file to disk before we can read it
    let savedPath = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const status = await obs.call("GetLastReplayBufferReplay");
        log.info(`Poll ${i + 1}/20: ${status.savedReplayPath || "(no path yet)"}`);
        if (status.savedReplayPath && fs.existsSync(status.savedReplayPath)) {
          savedPath = status.savedReplayPath;
          break;
        }
      } catch (err) {
        log.info(`Poll ${i + 1}/20: not ready (${err.message})`);
      }
    }

    if (!savedPath) {
      log.error("Could not determine saved replay buffer file path.");
      process.exit(1);
    }

    log.info(`Replay file: ${savedPath} (${fileSize(savedPath)} bytes)`);

    const ext = path.extname(savedPath);
    const base = path.basename(savedPath, ext);
    const dst = path.join(CLIP_OUTPUT_DIR, `${base}_${seconds}s${ext}`);

    await trimLastNSeconds(savedPath, dst, seconds);

    const outputDuration = await getVideoDuration(dst);
    log.info(`Output file: ${dst} (${fileSize(dst)} bytes)`);
    log.info(`Output duration: ${outputDuration}s`);
    log.info(`Saved ${seconds}s clip: ${dst}`);
  } catch (err) {
    log.error(`Error: ${err.message}`);
    if (err.stderr) {
      log.error(`Command stderr:\n${String(err.stderr).trim()}`);
    }
    process.exit(1);
  } finally {
    await obs.disconnect();
    log.info("Disconnected from OBS");
  }
}

main();
