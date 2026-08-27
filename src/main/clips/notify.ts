import { listClips } from "../../shared/clips/index.js";
import { IpcChannels } from "../../shared/ipc.js";
import { getAppDataDir } from "../session.js";
import { updateTrayBadge } from "../tray.js";
import { mainAndCutterWindows } from "../windows/broadcast.js";
import { withClipUrls } from "./urls.js";

export function sendClipsChanged(): void {
  const payload = withClipUrls(listClips(getAppDataDir()));
  for (const win of mainAndCutterWindows()) {
    win.webContents.send(IpcChannels.clipsChanged, payload);
  }
  updateTrayBadge();
}
