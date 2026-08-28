import { Notification } from "electron";
import { APP_NAME } from "../shared/app.config.js";
import { IpcChannels, type HotkeyClipPayload } from "../shared/ipc.js";
import { runCreateClip } from "./clips/create.js";
import { registerAppHotkeys } from "./hotkeys.js";
import { getConfig } from "./session.js";
import {
  sendToMainWindow,
  toggleQuickActionWindow,
  windowCanShowToast,
} from "./windows/index.js";

export function syncPresetHotkeys(notify: boolean): string[] {
  const config = getConfig();
  const failed = registerAppHotkeys({
    presets: config.CLIP_PRESETS,
    quickActionHotkey: config.QUICK_ACTION_HOTKEY,
    onClip: (seconds) => {
      void handlePresetHotkey(seconds);
    },
    onQuickAction: () => {
      toggleQuickActionWindow();
    },
  });
  if (notify && failed.length > 0) {
    sendToMainWindow(IpcChannels.hotkeysFailed, failed);
  }
  return failed;
}

export async function handlePresetHotkey(
  seconds: number,
  title?: string,
): Promise<void> {
  const result = await runCreateClip(seconds, { log: true, title });
  const payload: HotkeyClipPayload = { seconds, result, title };
  sendToMainWindow(IpcChannels.hotkeyClip, payload);
  if (windowCanShowToast()) return;
  const body = result.ok
    ? title
      ? `„${title}“ gespeichert (${seconds}s)`
      : `Clip gespeichert (${seconds}s)`
    : result.error;
  new Notification({ title: APP_NAME, body }).show();
}
