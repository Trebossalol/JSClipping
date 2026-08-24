import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import {
  IpcChannels,
  type AppConfigDto,
  type ClipRecord,
  type CreateClipResult,
  type CutClipResult,
  type CutRange,
  type ElectronApi,
  type ObsStatus,
  type RenameClipResult,
  type StorageInfoResult,
} from "../shared/ipc.js";

const api: ElectronApi = {
  getConfig: () => ipcRenderer.invoke(IpcChannels.getConfig),
  saveConfig: (config: AppConfigDto) =>
    ipcRenderer.invoke(IpcChannels.saveConfig, config),
  pickOutputDir: () => ipcRenderer.invoke(IpcChannels.pickOutputDir),
  getObsStatus: () => ipcRenderer.invoke(IpcChannels.getObsStatus),
  onObsStatus: (callback: (status: ObsStatus) => void) => {
    const listener = (_event: IpcRendererEvent, status: ObsStatus): void => {
      callback(status);
    };
    ipcRenderer.on(IpcChannels.obsStatusChanged, listener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.obsStatusChanged, listener);
    };
  },
  createClip: (seconds: number): Promise<CreateClipResult> =>
    ipcRenderer.invoke(IpcChannels.createClip, seconds),
  listClips: () => ipcRenderer.invoke(IpcChannels.listClips),
  onClipsChanged: (callback: (clips: ClipRecord[]) => void) => {
    const listener = (_event: IpcRendererEvent, clips: ClipRecord[]): void => {
      callback(clips);
    };
    ipcRenderer.on(IpcChannels.clipsChanged, listener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.clipsChanged, listener);
    };
  },
  renameClip: (id: string, name: string): Promise<RenameClipResult> =>
    ipcRenderer.invoke(IpcChannels.renameClip, id, name),
  deleteClip: (id: string) => ipcRenderer.invoke(IpcChannels.deleteClip, id),
  cutClip: (id: string, ranges: CutRange[]): Promise<CutClipResult> =>
    ipcRenderer.invoke(IpcChannels.cutClip, id, ranges),
  getClip: (id: string) => ipcRenderer.invoke(IpcChannels.getClip, id),
  openCutter: (id: string) => ipcRenderer.invoke(IpcChannels.openCutter, id),
  openClip: (id: string) => ipcRenderer.invoke(IpcChannels.openClip, id),
  revealClip: (id: string) => ipcRenderer.invoke(IpcChannels.revealClip, id),
  getStorage: (): Promise<StorageInfoResult> =>
    ipcRenderer.invoke(IpcChannels.getStorage),
  startObs: () => ipcRenderer.invoke(IpcChannels.startObs),
  stopObs: () => ipcRenderer.invoke(IpcChannels.stopObs),
};

contextBridge.exposeInMainWorld("api", api);
