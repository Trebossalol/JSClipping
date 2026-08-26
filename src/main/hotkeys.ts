import { globalShortcut } from "electron";
import type { ClipPreset } from "../shared/ipc.js";

const registered = new Set<string>();

export function registerAppHotkeys(options: {
  presets: ClipPreset[];
  quickActionHotkey: string | null;
  onClip: (seconds: number) => void;
  onQuickAction: () => void;
}): string[] {
  unregisterAppHotkeys();
  const failed: string[] = [];
  const seen = new Set<string>();

  function tryRegister(accelerator: string, callback: () => void): void {
    if (seen.has(accelerator)) return;
    seen.add(accelerator);
    const ok = globalShortcut.register(accelerator, callback);
    if (ok) {
      registered.add(accelerator);
    } else {
      failed.push(accelerator);
    }
  }

  if (options.quickActionHotkey) {
    tryRegister(options.quickActionHotkey, options.onQuickAction);
  }
  for (const preset of options.presets) {
    if (!preset.hotkey) continue;
    tryRegister(preset.hotkey, () => options.onClip(preset.seconds));
  }
  return failed;
}

export function unregisterAppHotkeys(): void {
  for (const accelerator of registered) {
    globalShortcut.unregister(accelerator);
  }
  registered.clear();
}
