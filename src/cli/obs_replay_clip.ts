#!/usr/bin/env node
/**
 * Action Ring / CLI entry:
 *   tsx src/cli/obs_replay_clip.ts 30
 */
import fs from "node:fs";
import { OBSWebSocket } from "obs-websocket-js";
import { saveAndTrimClip } from "../shared/clip-service.js";
import { loadConfig } from "../shared/config.js";
import { createRunLog } from "../shared/log.js";
import { getObsReplayMaxSeconds } from "../shared/obs.js";
import { validateClipSeconds } from "../shared/paths.js";

const log = createRunLog("clip");

async function main(): Promise<void> {
  const config = loadConfig();
  const { OBS_URL, OBS_PASSWORD, CLIP_OUTPUT_DIR } = config;

  log.info(`Log file: ${log.filePath}`);
  log.info(`Requested clip length: ${process.argv[2] ?? "(none)"}s`);
  log.info(`OBS_URL: ${OBS_URL}`);
  log.info(`CLIP_OUTPUT_DIR: ${CLIP_OUTPUT_DIR}`);

  const seconds = parseInt(process.argv[2] ?? "", 10);
  if (!seconds || Number.isNaN(seconds)) {
    log.error("Usage: tsx src/cli/obs_replay_clip.ts <seconds>");
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
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Could not connect to OBS WebSocket: ${message}`);
    process.exit(1);
  }

  try {
    let maxSeconds: number | null = null;
    try {
      maxSeconds = await getObsReplayMaxSeconds(obs);
    } catch {
      log.info("Could not read OBS replay buffer max");
    }
    const invalid = validateClipSeconds(seconds, maxSeconds);
    if (invalid) {
      log.error(invalid);
      process.exit(1);
    }
    if (maxSeconds != null) {
      log.info(`OBS replay buffer max: ${maxSeconds}s`);
    }
    const result = await saveAndTrimClip({
      obs,
      seconds,
      outputDir: CLIP_OUTPUT_DIR,
      log,
    });
    log.info(`Done: ${result.outputPath}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Error: ${message}`);
    if (err && typeof err === "object" && "stderr" in err) {
      log.error(`Command stderr:\n${String((err as { stderr: unknown }).stderr).trim()}`);
    }
    process.exit(1);
  } finally {
    await obs.disconnect();
    log.info("Disconnected from OBS");
  }
}

main();
