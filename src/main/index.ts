import fs from "node:fs";
import { join } from "node:path";
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
import { isVideoFile, APP_NAME } from "../shared/paths.js";
import {
  createAppTray,
  destroyTray,
  isAppQuitting,
  markAppQuitting,
  setTrayAppDataDir,
  updateTrayBadge,
} from "./tray.js";

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
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempt = 0;
let intentionalDisconnect = false;
let folderWatcher: FSWatcher | null = null;
let clipping = false;

function withThumbUrls(clips: ClipRecord[]): ClipRecord[] {
  return clips.map((clip) => ({
    ...clip,
    thumbnailPath: clip.thumbnailPath
      ? `thumb://clip/${clip.id}.jpg`
      : null,
  }));
}

function sendObsStatus(): void {
  const status: ObsStatus = {
    connected: obsConnected,
    error: obsError,
  };
  mainWindow?.webContents.send(IpcChannels.obsStatusChanged, status);
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
    obsError = "Disconnected from OBS";
    sendObsStatus();
    if (!intentionalDisconnect) scheduleReconnect();
  });
  obs.on("ConnectionError", (err) => {
    obsConnected = false;
    obsError = err instanceof Error ? err.message : String(err);
    sendObsStatus();
  });

  try {
    await obs.connect(config.OBS_URL, config.OBS_PASSWORD);
    obsConnected = true;
    obsError = undefined;
    reconnectAttempt = 0;
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
    show: true,
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
      config = saveConfig(next, appDataDir);

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
      title: "Choose clip output folder",
      defaultPath: config.CLIP_OUTPUT_DIR,
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0] ?? null;
  });

  ipcMain.handle(
    IpcChannels.getObsStatus,
    (): ObsStatus => ({
      connected: obsConnected,
      error: obsError,
    }),
  );

  ipcMain.handle(
    IpcChannels.createClip,
    async (_event, seconds: number): Promise<CreateClipResult> => {
      if (clipping) {
        return { ok: false, error: "A clip is already in progress." };
      }
      if (!obsConnected) {
        return { ok: false, error: "OBS WebSocket is not connected." };
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
    IpcChannels.openClip,
    async (_event, id: string): Promise<{ ok: boolean; error?: string }> => {
      const clip = findClip(appDataDir, id);
      if (!clip) return { ok: false, error: "Clip not found." };
      if (!clip.filePath) return { ok: false, error: "No file path." };
      const err = await shell.openPath(clip.filePath);
      if (err) return { ok: false, error: err };
      return { ok: true };
    },
  );

  ipcMain.handle(
    IpcChannels.revealClip,
    async (_event, id: string): Promise<{ ok: boolean; error?: string }> => {
      const clip = findClip(appDataDir, id);
      if (!clip) return { ok: false, error: "Clip not found." };
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
  await connectObs();

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
  destroyTray();
  void folderWatcher?.close();
  void obs.disconnect();
});
