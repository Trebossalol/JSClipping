/**
 * BrowserWindow helpers: main library, cutter, and the quick-action overlay.
 */
export {
  sendToMainWindow,
  windowCanShowToast,
} from "./broadcast.js";
export { openCutterWindow } from "./cutter.js";
export { createMainWindow, showMainWindow } from "./main.js";
export {
  closeQuickActionWindow,
  hideQuickActionWindow,
  toggleQuickActionWindow,
} from "./quick-action.js";
export { getMainWindow } from "./state.js";
