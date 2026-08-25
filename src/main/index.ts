import fs, { createReadStream } from "node:fs";
import { execFile, spawn } from "node:child_process";
import { basename, dirname, extname, join } from "node:path";
import { Readable } from "node:stream";
import { promisify } from "node:util";
import { pathToFileURL, fileURLToPath } from "node:url";
import { watch, type FSWatcher } from "chokidar";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  shell,
} from "electron";
import { OBSWebSocket } from "obs-websocket-js";
import { APP_ID, APP_NAME, APP_USER_MODEL_ID } from "../shared/app.config.js";
import { saveAndTrimClip } from "../shared/clip-service.js";
import {
  loadConfig,
  saveConfig,
  setAppDataDir,
  type AppConfig,
} from "../shared/config.js";
import {
  cutClipOverwrite,
  cutClipToNewFile,
  deleteClip,
  findClip,
  ignorePathTemporarily,
  importClipFromFile,
  isIgnoredPath,
  listClips,
  removeClipByFilePath,
  renameClip,
  scanAndImportExisting,
  thumbnailsDir,
  waitForStableFile,
} from "../shared/clips/index.js";
import {
  IpcChannels,
  type AppConfigDto,
  type ClipRecord,
  type CreateClipResult,
  type CutClipResult,
  type CutRange,
  type ObsStatus,
  type RenameClipResult,
  type StorageInfoResult,
} from "../shared/ipc.js";
import { getStorageInfo } from "../shared/storage.js";
import { createRunLog } from "../shared/log.js";
import { getObsReplayMaxSeconds } from "../shared/obs.js";
import {
  getAutostartBatPath,
  getRepoRoot,
  isPackagedApp,
  isVideoFile,
  parseClipSecondsArg,
  resolveObsExecutable,
  validateClipSeconds,
} from "../shared/paths.js";
import {
  createAppTray,
  destroyTray,
  isAppQuitting,
  markAppQuitting,
  setTrayAppDataDir,
  updateTrayBadge,
} from "./tray.js";
import { getAppIcon } from "./tray-icon.js";
import {
  setAppAutostartEnabled,
  startedAtLogin,
} from "./autostart.js";

const execFileAsync = promisify(execFile);
const OBS_IMAGE = "obs64.exe";

const preloadPath = fileURLToPath(
  new URL("../preload/index.mjs", import.meta.url),
);

const mediaPrivileges = {
  standard: true,
  secure: true,
  supportFetchAPI: true,
  bypassCSP: true,
  stream: true,
} as const;

protocol.registerSchemesAsPrivileged([
  { scheme: "thumb", privileges: { ...mediaPrivileges } },
  { scheme: "media", privileges: { ...mediaPrivileges } },
]);

app.setName(APP_NAME);
app.setAppUserModelId(APP_USER_MODEL_ID);

let mainWindow: BrowserWindow | null = null;
let cutterWindow: BrowserWindow | null = null;
let appDataDir = "";
let config: AppConfig;
let obs = new OBSWebSocket();
let obsConnected = false;
let obsError: string | undefined;
let replayBufferActive: boolean | null = null;
let replayMaxSeconds: number | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempt = 0;
let intentionalDisconnect = false;
let folderWatcher: FSWatcher | null = null;
let clipping = false;
let cutting = false;
let obsProcessRunning = false;
let obsProcessPoll: NodeJS.Timeout | null = null;
let pendingClipSeconds: number | null = parseClipSecondsArg(process.argv);
let appReadyForClip = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForObsConnected(timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (obsConnected) return true;
    await sleep(250);
  }
  return obsConnected;
}

function withClipUrls(clips: ClipRecord[]): ClipRecord[] {
  return clips.map((clip) => ({
    ...clip,
    thumbnailPath: clip.thumbnailPath
      ? `thumb://clip/${clip.id}.jpg`
      : null,
    mediaUrl: `media://clip/${clip.id}`,
  }));
}

function videoMime(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case ".webm":
      return "video/webm";
    case ".mkv":
      return "video/x-matroska";
    case ".mov":
      return "video/quicktime";
    case ".m4v":
      return "video/x-m4v";
    default:
      return "video/mp4";
  }
}

function serveMediaFile(filePath: string, request: Request): Response {
  const { size } = fs.statSync(filePath);
  const type = videoMime(filePath);
  const rangeHeader = request.headers.get("range");
  let start = 0;
  let end = size - 1;
  let status = 200;

  if (rangeHeader) {
    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (!match) {
      return new Response("Invalid Range", { status: 416 });
    }
    start = match[1] ? Number(match[1]) : 0;
    end = match[2] ? Number(match[2]) : size - 1;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      start >= size ||
      start > end
    ) {
      return new Response("Range Not Satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    end = Math.min(end, size - 1);
    status = 206;
  }

  const stream = createReadStream(filePath, { start, end });
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Content-Length": String(end - start + 1),
    "Accept-Ranges": "bytes",
  };
  if (status === 206) {
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status,
    headers,
  });
}

function currentObsStatus(): ObsStatus {
  return {
    connected: obsConnected,
    running: obsConnected || obsProcessRunning,
    error: obsError,
    replayBufferActive: obsConnected ? replayBufferActive : false,
    replayMaxSeconds: obsConnected ? replayMaxSeconds : null,
  };
}

async function isObsProcessRunning(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      "tasklist",
      ["/FI", `IMAGENAME eq ${OBS_IMAGE}`, "/FO", "CSV", "/NH"],
      { windowsHide: true },
    );
    return stdout.toLowerCase().includes(OBS_IMAGE.toLowerCase());
  } catch {
    return false;
  }
}

async function refreshObsProcessRunning(): Promise<void> {
  const next = await isObsProcessRunning();
  if (next === obsProcessRunning) return;
  obsProcessRunning = next;
  sendObsStatus();
}

async function killObsProcess(): Promise<void> {
  try {
    await execFileAsync("taskkill", ["/IM", OBS_IMAGE, "/T"], {
      windowsHide: true,
    });
  } catch {
    // Process may already be gone or ignored WM_CLOSE.
  }
  if (!(await isObsProcessRunning())) return;
  try {
    await execFileAsync("taskkill", ["/IM", OBS_IMAGE, "/T", "/F"], {
      windowsHide: true,
    });
  } catch {
    // ignore
  }
}

function spawnDetached(command: string, args: string[], cwd: string): void {
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

function markObsLaunchRequested(): void {
  obsProcessRunning = true;
  intentionalDisconnect = false;
  reconnectAttempt = 0;
  sendObsStatus();
  if (!obsConnected) scheduleReconnect();
}

async function startObsClipMode(): Promise<{ ok: boolean; error?: string }> {
  const exe = resolveObsExecutable();
  if (exe) {
    try {
      spawnDetached(exe, ["--startreplaybuffer", "--minimize-to-tray"], dirname(exe));
      markObsLaunchRequested();
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }

  if (!isPackagedApp()) {
    const bat = getAutostartBatPath();
    if (bat) {
      try {
        spawnDetached("cmd.exe", ["/d", "/c", bat], join(getRepoRoot(), "scripts"));
        markObsLaunchRequested();
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
      }
    }
  }

  return {
    ok: false,
    error:
      "OBS Studio wurde nicht gefunden. Installiere OBS unter dem Standardpfad oder setze die Umgebungsvariable OBS_PATH.",
  };
}

function startObsProcessPoll(): void {
  if (obsProcessPoll) return;
  obsProcessPoll = setInterval(() => {
    void refreshObsProcessRunning();
    if (!obsConnected) return;
    void refreshReplayMaxSeconds().then((changed) => {
      if (changed) sendObsStatus();
    });
  }, 2000);
}

function sendObsStatus(): void {
  mainWindow?.webContents.send(IpcChannels.obsStatusChanged, currentObsStatus());
}

async function refreshReplayBuffer(): Promise<void> {
  if (!obsConnected) {
    replayBufferActive = false;
    return;
  }
  try {
    const status = await obs.call("GetReplayBufferStatus");
    replayBufferActive = Boolean(status.outputActive);
  } catch {
    replayBufferActive = null;
  }
}

async function refreshReplayMaxSeconds(): Promise<boolean> {
  if (!obsConnected) {
    const changed = replayMaxSeconds !== null;
    replayMaxSeconds = null;
    return changed;
  }
  try {
    const next = await getObsReplayMaxSeconds(obs);
    const changed = replayMaxSeconds !== next;
    replayMaxSeconds = next;
    return changed;
  } catch {
    return false;
  }
}

async function ensureReplayBufferStarted(): Promise<void> {
  if (!obsConnected) return;
  await refreshReplayBuffer();
  if (replayBufferActive === true) return;
  try {
    await obs.call("StartReplayBuffer");
    replayBufferActive = true;
    sendObsStatus();
  } catch {
    // Replay buffer may be disabled in OBS settings.
  }
}

function sendClipsChanged(): void {
  const payload = withClipUrls(listClips(appDataDir));
  for (const win of [mainWindow, cutterWindow]) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(IpcChannels.clipsChanged, payload);
    }
  }
  updateTrayBadge();
}

async function disconnectObs(): Promise<void> {
  intentionalDisconnect = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  try {
    await obs.disconnect();
  } catch {
    // ignore
  }
  obsConnected = false;
}

function scheduleReconnect(): void {
  if (reconnectTimer || intentionalDisconnect) return;
  const delay = Math.min(30_000, 1000 * 2 ** reconnectAttempt);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectObs();
  }, delay);
}

async function connectObs(): Promise<void> {
  intentionalDisconnect = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  try {
    await obs.disconnect();
  } catch {
    // ignore
  }

  obs = new OBSWebSocket();
  obs.on("ConnectionClosed", () => {
    obsConnected = false;
    obsError = "Verbindung zu OBS getrennt";
    replayBufferActive = false;
    replayMaxSeconds = null;
    sendObsStatus();
    void refreshObsProcessRunning();
    if (!intentionalDisconnect) scheduleReconnect();
  });
  obs.on("ReplayBufferStateChanged", (event) => {
    replayBufferActive = Boolean(event.outputActive);
    sendObsStatus();
  });
  obs.on("CurrentProfileChanged", () => {
    void refreshReplayMaxSeconds().then((changed) => {
      if (changed) sendObsStatus();
    });
  });
  obs.on("ConnectionError", (err) => {
    obsConnected = false;
    obsError = err instanceof Error ? err.message : String(err);
    replayBufferActive = false;
    replayMaxSeconds = null;
    sendObsStatus();
  });

  try {
    await obs.connect(config.OBS_URL, config.OBS_PASSWORD);
    obsConnected = true;
    obsProcessRunning = true;
    obsError = undefined;
    reconnectAttempt = 0;
    await refreshReplayBuffer();
    await refreshReplayMaxSeconds();
    sendObsStatus();
  } catch (err) {
    obsConnected = false;
    obsError = err instanceof Error ? err.message : String(err);
    sendObsStatus();
    scheduleReconnect();
  }
}

/** Untrimmed OBS replay dumps (`Replay 2026-…`) — keep `_30s` clips. */
function looksLikeUntrimmedReplay(filePath: string): boolean {
  const stem = basename(filePath, extname(filePath));
  return /^Replay\b/i.test(stem) && !/_\d+s$/i.test(stem);
}

async function handleNewVideo(filePath: string): Promise<void> {
  if (!isVideoFile(filePath) || isIgnoredPath(filePath)) return;
  if (clipping || looksLikeUntrimmedReplay(filePath)) return;
  const stable = await waitForStableFile(filePath);
  if (!stable || isIgnoredPath(filePath) || clipping) return;
  if (!isVideoFile(filePath)) return;
  if (looksLikeUntrimmedReplay(filePath)) return;

  const record = await importClipFromFile(
    { appDataDir, outputDir: config.CLIP_OUTPUT_DIR },
    filePath,
  );
  if (record) sendClipsChanged();
}

async function handleRemovedVideo(filePath: string): Promise<void> {
  if (!isVideoFile(filePath) || isIgnoredPath(filePath)) return;
  const removed = removeClipByFilePath(appDataDir, filePath);
  if (!removed) return;
  sendClipsChanged();
}

function startFolderWatcher(): void {
  if (folderWatcher) {
    void folderWatcher.close();
    folderWatcher = null;
  }

  const dir = config.CLIP_OUTPUT_DIR;
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

const windowPrefs = {
  preload: preloadPath,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false,
} as const;

function loadRenderer(win: BrowserWindow, hash?: string): void {
  if (process.env.ELECTRON_RENDERER_URL) {
    const base = process.env.ELECTRON_RENDERER_URL;
    void win.loadURL(hash ? `${base}#${hash}` : base);
    return;
  }
  void win.loadFile(join(__dirname, "../renderer/index.html"), hash ? { hash } : undefined);
}

function cutterHash(id: string): string {
  return `cut/${encodeURIComponent(id)}`;
}

function openCutterWindow(id?: string): { ok: true } | { ok: false; error: string } {
  if (id) {
    const clip = findClip(appDataDir, id);
    if (!clip) return { ok: false, error: "Clip nicht gefunden." };
    if (clip.missing || !clip.filePath || !fs.existsSync(clip.filePath)) {
      return { ok: false, error: "Die Clip-Datei fehlt." };
    }
  }

  if (cutterWindow && !cutterWindow.isDestroyed()) {
    cutterWindow.show();
    if (cutterWindow.isMinimized()) cutterWindow.restore();
    cutterWindow.focus();
    if (id) {
      cutterWindow.webContents.send(IpcChannels.cutterOpenClip, id);
    }
    return { ok: true };
  }

  cutterWindow = new BrowserWindow({
    width: 980,
    height: 860,
    minWidth: 720,
    minHeight: 640,
    title: "Schneiden",
    icon: getAppIcon(),
    show: true,
    autoHideMenuBar: true,
    webPreferences: { ...windowPrefs },
  });
  loadRenderer(cutterWindow, id ? cutterHash(id) : "cut");
  cutterWindow.on("closed", () => {
    cutterWindow = null;
  });
  return { ok: true };
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 780,
    minWidth: 720,
    minHeight: 560,
    title: APP_NAME,
    icon: getAppIcon(),
    show: !startedAtLogin() && pendingClipSeconds == null,
    webPreferences: { ...windowPrefs },
  });

  loadRenderer(mainWindow);

  mainWindow.on("close", (event) => {
    if (!isAppQuitting()) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function runCreateClip(
  seconds: number,
  options?: { log?: boolean },
): Promise<CreateClipResult> {
  const tooShort = validateClipSeconds(seconds);
  if (tooShort) return { ok: false, error: tooShort };
  const length = Math.floor(seconds);

  if (clipping) {
    return { ok: false, error: "Ein Clip wird bereits erstellt." };
  }
  if (!obsConnected) {
    await waitForObsConnected();
  }
  if (!obsConnected) {
    return { ok: false, error: "OBS-WebSocket ist nicht verbunden." };
  }

  await refreshReplayMaxSeconds();
  const tooLong = validateClipSeconds(length, replayMaxSeconds);
  if (tooLong) return { ok: false, error: tooLong };

  const log = options?.log ? createRunLog("clip") : undefined;
  log?.info(`Requested clip length: ${length}s`);
  log?.info(`CLIP_OUTPUT_DIR: ${config.CLIP_OUTPUT_DIR}`);

  clipping = true;
  try {
    const result = await saveAndTrimClip({
      obs,
      seconds: length,
      outputDir: config.CLIP_OUTPUT_DIR,
      log,
      onReplaySaved: (savedPath) => {
        ignorePathTemporarily(savedPath, 30_000);
      },
    });
    removeClipByFilePath(appDataDir, result.sourcePath);
    await importClipFromFile(
      { appDataDir, outputDir: config.CLIP_OUTPUT_DIR },
      result.outputPath,
      { durationSeconds: result.durationSeconds },
    );
    sendClipsChanged();
    log?.info(`Done: ${result.outputPath}`);
    return { ok: true, outputPath: result.outputPath };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log?.error(`Error: ${message}`);
    return { ok: false, error: message };
  } finally {
    clipping = false;
  }
}

async function handleClipArg(seconds: number): Promise<void> {
  const result = await runCreateClip(seconds, { log: true });
  if (!result.ok) {
    console.error(result.error);
  }
}

function flushPendingClip(): void {
  if (pendingClipSeconds == null) return;
  const seconds = pendingClipSeconds;
  pendingClipSeconds = null;
  void handleClipArg(seconds);
}

function showMainWindowFromSecondInstance(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return;
  }
  createWindow();
}

function registerIpc(): void {
  ipcMain.handle(IpcChannels.getConfig, (): AppConfigDto => ({ ...config }));

  ipcMain.handle(
    IpcChannels.saveConfig,
    async (_event, next: AppConfigDto): Promise<AppConfigDto> => {
      const prevOutput = config.CLIP_OUTPUT_DIR;
      const prevUrl = config.OBS_URL;
      const prevPass = config.OBS_PASSWORD;
      const prevAutostart = config.AUTOSTART;
      setAppAutostartEnabled(next.AUTOSTART, appDataDir);
      config = saveConfig(next, appDataDir);

      if (config.AUTOSTART && !prevAutostart) {
        if (!(await isObsProcessRunning())) {
          await startObsClipMode();
        } else {
          await ensureReplayBufferStarted();
        }
      }

      if (config.CLIP_OUTPUT_DIR !== prevOutput) {
        startFolderWatcher();
        await scanAndImportExisting({
          appDataDir,
          outputDir: config.CLIP_OUTPUT_DIR,
        });
        sendClipsChanged();
      }

      if (
        config.OBS_URL !== prevUrl ||
        config.OBS_PASSWORD !== prevPass
      ) {
        await disconnectObs();
        await connectObs();
      }

      return { ...config };
    },
  );

  ipcMain.handle(IpcChannels.pickOutputDir, async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory", "createDirectory"],
      title: "Clip-Ausgabeordner wählen",
      defaultPath: config.CLIP_OUTPUT_DIR,
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0] ?? null;
  });

  ipcMain.handle(IpcChannels.getObsStatus, (): ObsStatus => currentObsStatus());

  ipcMain.handle(
    IpcChannels.startObs,
    async (): Promise<{ ok: boolean; error?: string }> => {
      return startObsClipMode();
    },
  );

  ipcMain.handle(
    IpcChannels.stopObs,
    async (): Promise<{ ok: boolean; error?: string }> => {
      intentionalDisconnect = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      try {
        await obs.disconnect();
      } catch {
        // ignore
      }
      obsConnected = false;
      replayBufferActive = false;
      replayMaxSeconds = null;
      try {
        await killObsProcess();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        sendObsStatus();
        return { ok: false, error: message };
      }
      obsProcessRunning = false;
      sendObsStatus();
      return { ok: true };
    },
  );

  ipcMain.handle(
    IpcChannels.createClip,
    async (_event, seconds: number): Promise<CreateClipResult> => {
      return runCreateClip(seconds);
    },
  );

  ipcMain.handle(IpcChannels.listClips, () => withClipUrls(listClips(appDataDir)));

  ipcMain.handle(IpcChannels.getClip, (_event, id: string): ClipRecord | null => {
    const clip = findClip(appDataDir, id);
    if (!clip) return null;
    return withClipUrls([clip])[0] ?? null;
  });

  ipcMain.handle(
    IpcChannels.openCutter,
    (_event, id?: string): { ok: boolean; error?: string } => {
      return openCutterWindow(typeof id === "string" ? id : undefined);
    },
  );

  ipcMain.handle(
    IpcChannels.renameClip,
    async (_event, id: string, name: string): Promise<RenameClipResult> => {
      const result = renameClip(appDataDir, id, name);
      if (result.ok) {
        sendClipsChanged();
        return { ok: true, clip: withClipUrls([result.clip])[0]! };
      }
      return result;
    },
  );

  ipcMain.handle(
    IpcChannels.deleteClip,
    async (_event, id: string): Promise<{ ok: boolean; error?: string }> => {
      const result = deleteClip(appDataDir, id);
      if (result.ok) {
        sendClipsChanged();
      }
      return result;
    },
  );

  ipcMain.handle(
    IpcChannels.cutClip,
    async (
      _event,
      id: string,
      ranges: CutRange[],
      overwrite?: boolean,
    ): Promise<CutClipResult> => {
      if (cutting) {
        return { ok: false, error: "Ein Clip wird bereits geschnitten." };
      }
      cutting = true;
      try {
        const options = { appDataDir, outputDir: config.CLIP_OUTPUT_DIR };
        const result = overwrite
          ? await cutClipOverwrite(options, id, ranges)
          : await cutClipToNewFile(options, id, ranges);
        if (result.ok) {
          sendClipsChanged();
          return { ok: true, clip: withClipUrls([result.clip])[0]! };
        }
        return result;
      } finally {
        cutting = false;
      }
    },
  );

  ipcMain.handle(
    IpcChannels.getStorage,
    async (): Promise<StorageInfoResult> => {
      try {
        const info = await getStorageInfo(config.CLIP_OUTPUT_DIR);
        return { ok: true, info };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
      }
    },
  );

  ipcMain.handle(
    IpcChannels.openClip,
    async (_event, id: string): Promise<{ ok: boolean; error?: string }> => {
      const clip = findClip(appDataDir, id);
      if (!clip) return { ok: false, error: "Clip nicht gefunden." };
      if (!clip.filePath) return { ok: false, error: "Kein Dateipfad." };
      const err = await shell.openPath(clip.filePath);
      if (err) return { ok: false, error: err };
      return { ok: true };
    },
  );

  ipcMain.handle(
    IpcChannels.revealClip,
    async (_event, id: string): Promise<{ ok: boolean; error?: string }> => {
      const clip = findClip(appDataDir, id);
      if (!clip) return { ok: false, error: "Clip nicht gefunden." };
      shell.showItemInFolder(clip.filePath);
      return { ok: true };
    },
  );
}

const gotSingleInstanceLock = app.requestSingleInstanceLock(
  pendingClipSeconds != null ? { clipSeconds: pendingClipSeconds } : {},
);

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    const seconds = parseClipSecondsArg(commandLine);
    if (seconds != null) {
      if (appReadyForClip) {
        void handleClipArg(seconds);
      } else {
        pendingClipSeconds = seconds;
      }
      return;
    }
    if (app.isReady()) {
      showMainWindowFromSecondInstance();
    }
  });
}

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return;

  appDataDir = app.getPath("userData");
  // Prefer %APPDATA%\EasyClip so CLI and Electron share config
  if (process.env.APPDATA) {
    const shared = join(process.env.APPDATA, APP_ID);
    appDataDir = shared;
  }
  setAppDataDir(appDataDir);
  setTrayAppDataDir(appDataDir);

  protocol.handle("thumb", (request) => {
    try {
      const url = new URL(request.url);
      const id = decodeURIComponent(url.pathname.replace(/^\//, "").replace(/\.jpg$/i, ""));
      if (!id || id.includes("..") || id.includes("/") || id.includes("\\")) {
        return new Response("Bad Request", { status: 400 });
      }
      const file = join(thumbnailsDir(appDataDir), `${id}.jpg`);
      if (!fs.existsSync(file)) {
        return new Response("Not Found", { status: 404 });
      }
      return net.fetch(pathToFileURL(file).toString());
    } catch {
      return new Response("Error", { status: 500 });
    }
  });

  protocol.handle("media", (request) => {
    try {
      const url = new URL(request.url);
      const id = decodeURIComponent(url.pathname.replace(/^\//, "").replace(/\/$/, ""));
      if (!id || id.includes("..") || id.includes("/") || id.includes("\\")) {
        return new Response("Bad Request", { status: 400 });
      }
      const clip = findClip(appDataDir, id);
      if (!clip?.filePath || !fs.existsSync(clip.filePath)) {
        return new Response("Not Found", { status: 404 });
      }
      return serveMediaFile(clip.filePath, request);
    } catch {
      return new Response("Error", { status: 500 });
    }
  });

  config = loadConfig(appDataDir);
  try {
    setAppAutostartEnabled(config.AUTOSTART, appDataDir);
  } catch {
    // Login-item registry may be locked; settings can retry.
  }
  registerIpc();
  Menu.setApplicationMenu(null);
  createWindow();
  createAppTray({
    getWindow: () => mainWindow,
    createWindow,
  });
  startFolderWatcher();
  await scanAndImportExisting({
    appDataDir,
    outputDir: config.CLIP_OUTPUT_DIR,
  });
  sendClipsChanged();
  await refreshObsProcessRunning();
  startObsProcessPoll();
  if (config.AUTOSTART && !obsProcessRunning) {
    await startObsClipMode();
  }
  await connectObs();
  if (config.AUTOSTART) {
    await ensureReplayBufferStarted();
  }

  appReadyForClip = true;
  flushPendingClip();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // Keep the process alive in the system tray on Windows/Linux.
});

app.on("before-quit", () => {
  markAppQuitting();
  intentionalDisconnect = true;
  if (obsProcessPoll) {
    clearInterval(obsProcessPoll);
    obsProcessPoll = null;
  }
  destroyTray();
  void folderWatcher?.close();
  void obs.disconnect();
});
