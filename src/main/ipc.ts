/**
 * Renderer IPC handlers. Domain work is delegated to `obs/`, `clips/`, and `windows/`.
 */
import { dialog, ipcMain, shell } from "electron";
import {
  deleteClip,
  findClip,
  listClips,
  renameClip,
  scanAndImportExisting,
} from "../shared/clips/index.js";
import { IpcChannels, type AppConfigDto, type CutRange, type ScaleTarget } from "../shared/ipc.js";
import { configuredObsScene, configuredReplaySeconds } from "../shared/obs.js";
import { getStorageInfo } from "../shared/storage.js";
import { setAppAutostartEnabled } from "./autostart.js";
import {
  runCreateClip,
  runCutClip,
  sendClipsChanged,
  startFolderWatcher,
  withClipUrls,
} from "./clips/index.js";
import { handlePresetHotkey, syncPresetHotkeys } from "./hotkey-actions.js";
import {
  connectObs,
  currentObsStatus,
  disconnectObs,
  applyConfiguredReplayMaxSeconds,
  ensureReplayBufferStarted,
  fetchObsScenes,
  isObsProcessRunning,
  obsState,
  prepareObsClipScene,
  startObsClipMode,
  stopObsClipMode,
} from "./obs/index.js";
import { getAppDataDir, getConfig, persistConfig } from "./session.js";
import {
  getMainWindow,
  hideQuickActionWindow,
  openCutterWindow,
} from "./windows/index.js";

export function registerIpc(): void {
  ipcMain.handle(IpcChannels.getConfig, (): AppConfigDto => ({ ...getConfig() }));

  ipcMain.handle(
    IpcChannels.saveConfig,
    async (_event, next: AppConfigDto): Promise<AppConfigDto> => {
      const prev = getConfig();
      const prevOutput = prev.CLIP_OUTPUT_DIR;
      const prevUrl = prev.OBS_URL;
      const prevPass = prev.OBS_PASSWORD;
      const prevAutostart = prev.AUTOSTART;
      const prevScene = prev.OBS_SCENE;
      const prevReplay = prev.OBS_REPLAY_SECONDS;
      setAppAutostartEnabled(next.AUTOSTART, getAppDataDir());
      const config = persistConfig(next);
      syncPresetHotkeys(true);

      const credsChanged =
        config.OBS_URL !== prevUrl || config.OBS_PASSWORD !== prevPass;
      const sceneChanged =
        configuredObsScene(config.OBS_SCENE) !== configuredObsScene(prevScene);
      const replayChanged =
        configuredReplaySeconds(config.OBS_REPLAY_SECONDS) !==
        configuredReplaySeconds(prevReplay);

      if (config.AUTOSTART && !prevAutostart) {
        if (!(await isObsProcessRunning())) {
          await startObsClipMode();
        } else {
          await prepareObsClipScene();
          await applyConfiguredReplayMaxSeconds();
          await ensureReplayBufferStarted();
        }
      } else if (credsChanged) {
        await disconnectObs();
        await connectObs();
        if (obsState.connected) await prepareObsClipScene();
      } else if (obsState.connected) {
        if (sceneChanged) await prepareObsClipScene();
        if (replayChanged) await applyConfiguredReplayMaxSeconds();
      }

      if (config.CLIP_OUTPUT_DIR !== prevOutput) {
        startFolderWatcher();
        await scanAndImportExisting({
          appDataDir: getAppDataDir(),
          outputDir: config.CLIP_OUTPUT_DIR,
        });
        sendClipsChanged();
      }

      return { ...config };
    },
  );

  ipcMain.handle(IpcChannels.pickOutputDir, async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog(getMainWindow()!, {
      properties: ["openDirectory", "createDirectory"],
      title: "Clip-Ausgabeordner wählen",
      defaultPath: getConfig().CLIP_OUTPUT_DIR,
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0] ?? null;
  });

  ipcMain.handle(IpcChannels.pickObsExe, async (): Promise<string | null> => {
    const configured = getConfig().OBS_EXE_PATH.trim();
    const result = await dialog.showOpenDialog(getMainWindow()!, {
      properties: ["openFile"],
      title: "OBS-Programmdatei wählen",
      defaultPath:
        configured ||
        "C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe",
      filters: [{ name: "OBS", extensions: ["exe"] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0] ?? null;
  });

  ipcMain.handle(IpcChannels.getObsStatus, () => currentObsStatus());

  ipcMain.handle(IpcChannels.getObsScenes, () => fetchObsScenes());

  ipcMain.handle(IpcChannels.startObs, () => startObsClipMode());

  ipcMain.handle(IpcChannels.stopObs, () => stopObsClipMode());

  ipcMain.handle(IpcChannels.createClip, (_event, seconds: number) =>
    runCreateClip(seconds),
  );

  ipcMain.handle(IpcChannels.closeQuickAction, (): void => {
    hideQuickActionWindow();
  });

  ipcMain.handle(
    IpcChannels.selectQuickAction,
    (_event, seconds: number, title?: unknown): void => {
      hideQuickActionWindow();
      const name =
        typeof title === "string" && title.trim() ? title.trim() : undefined;
      void handlePresetHotkey(seconds, name);
    },
  );

  ipcMain.handle(IpcChannels.listClips, () =>
    withClipUrls(listClips(getAppDataDir())),
  );

  ipcMain.handle(IpcChannels.getClip, (_event, id: string) => {
    const clip = findClip(getAppDataDir(), id);
    if (!clip) return null;
    return withClipUrls([clip])[0] ?? null;
  });

  ipcMain.handle(IpcChannels.openCutter, (_event, id?: string) =>
    openCutterWindow(typeof id === "string" ? id : undefined),
  );

  ipcMain.handle(
    IpcChannels.renameClip,
    async (_event, id: string, name: string) => {
      const result = renameClip(getAppDataDir(), id, name);
      if (result.ok) {
        sendClipsChanged();
        return { ok: true, clip: withClipUrls([result.clip])[0]! };
      }
      return result;
    },
  );

  ipcMain.handle(IpcChannels.deleteClip, async (_event, id: string) => {
    const result = deleteClip(getAppDataDir(), id);
    if (result.ok) {
      sendClipsChanged();
    }
    return result;
  });

  ipcMain.handle(
    IpcChannels.cutClip,
    (
      _event,
      id: string,
      ranges: CutRange[],
      overwrite?: boolean,
      scale?: ScaleTarget | null,
      name?: string | null,
    ) => runCutClip(id, ranges, overwrite, scale, name),
  );

  ipcMain.handle(IpcChannels.getStorage, async () => {
    try {
      const info = await getStorageInfo(getConfig().CLIP_OUTPUT_DIR);
      return { ok: true, info };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  });

  ipcMain.handle(IpcChannels.openClip, async (_event, id: string) => {
    const clip = findClip(getAppDataDir(), id);
    if (!clip) return { ok: false, error: "Clip nicht gefunden." };
    if (!clip.filePath) return { ok: false, error: "Kein Dateipfad." };
    const err = await shell.openPath(clip.filePath);
    if (err) return { ok: false, error: err };
    return { ok: true };
  });

  ipcMain.handle(IpcChannels.revealClip, async (_event, id: string) => {
    const clip = findClip(getAppDataDir(), id);
    if (!clip) return { ok: false, error: "Clip nicht gefunden." };
    shell.showItemInFolder(clip.filePath);
    return { ok: true };
  });

  ipcMain.handle(IpcChannels.openExternal, async (_event, url: string) => {
    if (typeof url !== "string") {
      return { ok: false, error: "Ungültige Adresse." };
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, error: "Ungültige Adresse." };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { ok: false, error: "Ungültige Adresse." };
    }
    await shell.openExternal(parsed.toString());
    return { ok: true };
  });
}
