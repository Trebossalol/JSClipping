import fs from "node:fs";
import { basename, extname } from "node:path";
import { watch, type FSWatcher } from "chokidar";
import {
  importClipFromFile,
  isIgnoredPath,
  removeClipByFilePath,
  waitForStableFile,
} from "../../shared/clips/index.js";
import { isVideoFile } from "../../shared/paths.js";
import { getAppDataDir, getConfig } from "../session.js";
import { isClipping } from "./create.js";
import { sendClipsChanged } from "./notify.js";

let folderWatcher: FSWatcher | null = null;

/** Untrimmed OBS replay dumps (`Replay 2026-…`) — keep `_30s` clips. */
function looksLikeUntrimmedReplay(filePath: string): boolean {
  const stem = basename(filePath, extname(filePath));
  return /^Replay\b/i.test(stem) && !/_\d+s$/i.test(stem);
}

async function handleNewVideo(filePath: string): Promise<void> {
  if (!isVideoFile(filePath) || isIgnoredPath(filePath)) return;
  if (isClipping() || looksLikeUntrimmedReplay(filePath)) return;
  const stable = await waitForStableFile(filePath);
  if (!stable || isIgnoredPath(filePath) || isClipping()) return;
  if (!isVideoFile(filePath)) return;
  if (looksLikeUntrimmedReplay(filePath)) return;

  const record = await importClipFromFile(
    { appDataDir: getAppDataDir(), outputDir: getConfig().CLIP_OUTPUT_DIR },
    filePath,
  );
  if (record) sendClipsChanged();
}

async function handleRemovedVideo(filePath: string): Promise<void> {
  if (!isVideoFile(filePath) || isIgnoredPath(filePath)) return;
  const removed = removeClipByFilePath(getAppDataDir(), filePath);
  if (!removed) return;
  sendClipsChanged();
}

export function startFolderWatcher(): void {
  if (folderWatcher) {
    void folderWatcher.close();
    folderWatcher = null;
  }

  const dir = getConfig().CLIP_OUTPUT_DIR;
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // ignore
  }

  folderWatcher = watch(dir, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 800,
      pollInterval: 200,
    },
    depth: 4,
  });

  folderWatcher.on("add", (filePath) => {
    void handleNewVideo(filePath);
  });
  folderWatcher.on("unlink", (filePath) => {
    void handleRemovedVideo(filePath);
  });
}

export async function stopFolderWatcher(): Promise<void> {
  await folderWatcher?.close();
  folderWatcher = null;
}
