import { globalShortcut } from "electron";
import type { ClipPreset } from "../shared/ipc.js";

const registered = new Set<string>();

export function registerPresetHotkeys(
  presets: ClipPreset[],
  onClip: (seconds: number) => void,
): string[] {
  unregisterPresetHotkeys();
  const failed: string[] = [];
  const seen = new Set<string>();
  for (const preset of presets) {
    const accelerator = preset.hotkey;
    if (!accelerator || seen.has(accelerator)) continue;
    seen.add(accelerator);
    const ok = globalShortcut.register(accelerator, () => {
      onClip(preset.seconds);
    });
    if (ok) {
      registered.add(accelerator);
    } else {
      failed.push(accelerator);
    }
  }
  return failed;
}

export function unregisterPresetHotkeys(): void {
  for (const accelerator of registered) {
    globalShortcut.unregister(accelerator);
  }
  registered.clear();
}
