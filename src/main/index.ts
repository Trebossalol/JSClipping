import fs from "node:fs";
import { execFile, spawn } from "node:child_process";
import { join } from "node:path";
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
import { saveAndTrimClip } from "../shared/clip-service.js";
import {
  loadConfig,
  saveConfig,
  setAppDataDir,
  type AppConfig,
} from "../shared/config.js";
import {
  deleteClip,
  findClip,
  importClipFromFile,
  isIgnoredPath,
  listClips,
  renameClip,
  scanAndImportExisting,
  thumbnailsDir,
  waitForStableFile,
} from "../shared/clips-store.js";
import {
  IpcChannels,
  type AppConfigDto,
  type ClipRecord,
  type CreateClipResult,
  type ObsStatus,
  type RenameClipResult,
} from "../shared/ipc.js";
import { isVideoFile, APP_NAME, getRepoRoot } from "../shared/paths.js";
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

protocol.registerSchemesAsPrivileged([
  {
    scheme: "thumb",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true,
    },
  },
]);

app.setName(APP_NAME);

let mainWindow: BrowserWindow | null = null;
let appDataDir = "";
let config: AppConfig;
let obs = new OBSWebSocket();
let obsConnected = false;
let obsError: string | undefined;
let replayBufferActive: boolean | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempt = 0;
let intentionalDisconnect = false;
let folderWatcher: FSWatcher | null = null;
let clipping = false;
let obsProcessRunning = false;
let obsProcessPoll: NodeJS.Timeout | null = null;

function withThumbUrls(clips: ClipRecord[]): ClipRecord[] {
  return clips.map((clip) => ({
    ...clip,
    thumbnailPath: clip.thumbnailPath
      ? `thumb://clip/${clip.id}.jpg`
      : null,
  }));
}

function currentObsStatus(): ObsStatus {
  return {
    connected: obsConnected,
    running: obsConnected || obsProcessRunning,
    error: obsError,
    replayBufferActive: obsConnected ? replayBufferActive : false,
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

async function startObsClipMode(): Promise<{ ok: boolean; error?: string }> {
  const bat = join(getRepoRoot(), "scripts", "autostart.bat");
  if (!fs.existsSync(bat)) {
    return {
      ok: false,
      error: `autostart.bat nicht gefunden: ${bat}`,
    };
  }
  try {
    const child = spawn("cmd.exe", ["/d", "/c", bat], {
      cwd: join(getRepoRoot(), "scripts"),
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    obsProcessRunning = true;
    intentionalDisconnect = false;
    reconnectAttempt = 0;
    sendObsStatus();
    if (!obsConnected) scheduleReconnect();
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

function startObsProcessPoll(): void {
  if (obsProcessPoll) return;
  obsProcessPoll = setInterval(() => {
    void refreshObsProcessRunning();
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
  mainWindow?.webContents.send(
    IpcChannels.clipsChanged,
    withThumbUrls(listClips(appDataDir)),
  );
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
    sendObsStatus();
    void refreshObsProcessRunning();
    if (!intentionalDisconnect) scheduleReconnect();
  });
  obs.on("ReplayBufferStateChanged", (event) => {
    replayBufferActive = Boolean(event.outputActive);
    sendObsStatus();
  });
  obs.on("ConnectionError", (err) => {
    obsConnected = false;
    obsError = err instanceof Error ? err.message : String(err);
    replayBufferActive = false;
    sendObsStatus();
  });

  try {
    await obs.connect(config.OBS_URL, config.OBS_PASSWORD);
    obsConnected = true;
    obsProcessRunning = true;
    obsError = undefined;
    reconnectAttempt = 0;
    await refreshReplayBuffer();
    sendObsStatus();
  } catch (err) {
    obsConnected = false;
    obsError = err instanceof Error ? err.message : String(err);
    sendObsStatus();
    scheduleReconnect();
  }
}

async function handleNewVideo(filePath: string): Promise<void> {
  if (!isVideoFile(filePath) || isIgnoredPath(filePath)) return;
  const stable = await waitForStableFile(filePath);
  if (!stable || isIgnoredPath(filePath)) return;
  if (!isVideoFile(filePath)) return;

  const record = await importClipFromFile(
    { appDataDir, outputDir: config.CLIP_OUTPUT_DIR },
    filePath,
  );
  if (record) sendClipsChanged();
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
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 780,
    minWidth: 720,
    minHeight: 560,
    title: "JSClipping",
    icon: getAppIcon(),
    show: !startedAtLogin(),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

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
      if (clipping) {
        return { ok: false, error: "Ein Clip wird bereits erstellt." };
      }
      if (!obsConnected) {
        return { ok: false, error: "OBS-WebSocket ist nicht verbunden." };
      }
      clipping = true;
      try {
        const result = await saveAndTrimClip({
          obs,
          seconds,
          outputDir: config.CLIP_OUTPUT_DIR,
        });
        // Watcher will pick it up; also import eagerly for snappy UI
        await importClipFromFile(
          { appDataDir, outputDir: config.CLIP_OUTPUT_DIR },
          result.outputPath,
          { durationSeconds: result.durationSeconds },
        );
        sendClipsChanged();
        return { ok: true, outputPath: result.outputPath };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
      } finally {
        clipping = false;
      }
    },
  );

  ipcMain.handle(IpcChannels.listClips, () => withThumbUrls(listClips(appDataDir)));

  ipcMain.handle(
    IpcChannels.renameClip,
    async (_event, id: string, name: string): Promise<RenameClipResult> => {
      const result = renameClip(appDataDir, id, name);
      if (result.ok) {
        sendClipsChanged();
        return { ok: true, clip: withThumbUrls([result.clip])[0]! };
      }
      return result;
    },
  );

  ipcMain.handle(
    IpcChannels.deleteClip,
    async (_event, id: string): Promise<{ ok: boolean; error?: string }> => {
      const result = deleteClip(appDataDir, id);
      if (result.ok) sendClipsChanged();
      return result;
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

app.whenReady().then(async () => {
  appDataDir = app.getPath("userData");
  // Prefer %APPDATA%\JSClipping so CLI and Electron share config
  if (process.env.APPDATA) {
    const shared = join(process.env.APPDATA, APP_NAME);
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
