import { globalShortcut } from "electron";
import type { ClipPreset } from "../shared/ipc.js";

/**
 * OS-level hotkeys via Electron `globalShortcut`.
 *
 * These fire even when the main window is hidden in the tray. Two kinds:
 *   - Quick-action overlay (`config.QUICK_ACTION_HOTKEY`)
 *   - Clip presets (`preset.hotkey` → clip last N seconds)
 *
 * Accelerators are Electron strings (`CommandOrControl+Shift+C`). Canonical
 * form lives in `src/shared/hotkeys.ts`; this module only registers them.
 *
 * `registerAppHotkeys` always unregisters first, so a config save is a full
 * replace. Duplicate accelerators keep the first binding (quick action, then
 * presets in order). Shortcuts the OS already owns fail to register and are
 * returned so the renderer can warn.
 *
 * Call `unregisterAppHotkeys` on quit so the shortcuts do not linger after
 * the process exits.
 */
const registered = new Set<string>();

/**
 * Replace all app hotkeys. Returns accelerators that failed to register
 * (already taken by the OS or another app).
 */
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

/** Drop every shortcut this process registered. */
export function unregisterAppHotkeys(): void {
  for (const accelerator of registered) {
    globalShortcut.unregister(accelerator);
  }
  registered.clear();
}
