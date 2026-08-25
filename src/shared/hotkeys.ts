const MODIFIER_ORDER = [
  "CommandOrControl",
  "Alt",
  "AltGr",
  "Shift",
  "Super",
] as const;

const MODIFIER_ALIASES: Record<string, (typeof MODIFIER_ORDER)[number]> = {
  commandorcontrol: "CommandOrControl",
  cmdorctrl: "CommandOrControl",
  command: "CommandOrControl",
  cmd: "CommandOrControl",
  control: "CommandOrControl",
  ctrl: "CommandOrControl",
  alt: "Alt",
  option: "Alt",
  altgr: "AltGr",
  shift: "Shift",
  super: "Super",
  meta: "Super",
  win: "Super",
  windows: "Super",
};

const KEY_ALIASES: Record<string, string> = {
  esc: "Escape",
  escape: "Escape",
  return: "Enter",
  enter: "Enter",
  plus: "Plus",
  space: "Space",
  tab: "Tab",
  backspace: "Backspace",
  delete: "Delete",
  insert: "Insert",
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
  volumeup: "VolumeUp",
  volumedown: "VolumeDown",
  volumemute: "VolumeMute",
  medianexttrack: "MediaNextTrack",
  mediaprevioustrack: "MediaPreviousTrack",
  mediastop: "MediaStop",
  mediaplaypause: "MediaPlayPause",
  printscreen: "PrintScreen",
};

const CODE_TO_KEY: Record<string, string> = {
  Space: "Space",
  Tab: "Tab",
  Backspace: "Backspace",
  Delete: "Delete",
  Insert: "Insert",
  Enter: "Enter",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Escape: "Escape",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Backquote: "`",
  Comma: ",",
  Period: ".",
  Slash: "/",
  NumpadDecimal: "numdec",
  NumpadAdd: "numadd",
  NumpadSubtract: "numsub",
  NumpadMultiply: "nummult",
  NumpadDivide: "numdiv",
  AudioVolumeUp: "VolumeUp",
  AudioVolumeDown: "VolumeDown",
  AudioVolumeMute: "VolumeMute",
  MediaTrackNext: "MediaNextTrack",
  MediaTrackPrevious: "MediaPreviousTrack",
  MediaStop: "MediaStop",
  MediaPlayPause: "MediaPlayPause",
  PrintScreen: "PrintScreen",
};

const DISPLAY_KEYS: Record<string, string> = {
  CommandOrControl: "Strg",
  Alt: "Alt",
  AltGr: "AltGr",
  Shift: "Umschalt",
  Super: "Win",
  Plus: "+",
  Space: "Leertaste",
  Escape: "Esc",
  Enter: "Enter",
  Return: "Enter",
  Up: "↑",
  Down: "↓",
  Left: "←",
  Right: "→",
  PageUp: "Bild↑",
  PageDown: "Bild↓",
  Backspace: "Zurück",
  Delete: "Entf",
  Insert: "Einfg",
  Tab: "Tab",
};

const VALID_SPECIAL_KEYS = new Set([
  "Plus",
  "Space",
  "Tab",
  "Backspace",
  "Delete",
  "Insert",
  "Return",
  "Enter",
  "Up",
  "Down",
  "Left",
  "Right",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Escape",
  "Esc",
  "VolumeUp",
  "VolumeDown",
  "VolumeMute",
  "MediaNextTrack",
  "MediaPreviousTrack",
  "MediaStop",
  "MediaPlayPause",
  "PrintScreen",
  "numdec",
  "numadd",
  "numsub",
  "nummult",
  "numdiv",
  ";",
  "=",
  ",",
  "-",
  ".",
  "/",
  "`",
  "[",
  "\\",
  "]",
  "'",
]);

export interface HotkeyKeyEvent {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

function isValidKey(key: string): boolean {
  if (/^[A-Z0-9]$/.test(key)) return true;
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(key)) return true;
  if (/^num[0-9]$/.test(key)) return true;
  return VALID_SPECIAL_KEYS.has(key);
}

function canonicalizeKey(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const aliased = KEY_ALIASES[trimmed.toLowerCase()];
  if (aliased) return aliased;
  if (/^[a-z]$/i.test(trimmed)) return trimmed.toUpperCase();
  if (/^[0-9]$/.test(trimmed)) return trimmed;
  if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(trimmed)) return trimmed.toUpperCase();
  if (/^num[0-9]$/i.test(trimmed)) return trimmed.toLowerCase();
  if (isValidKey(trimmed)) return trimmed;
  return null;
}

function keyFromCode(code: string): string | null {
  if (code.startsWith("Key") && code.length === 4) {
    return code.slice(3);
  }
  if (code.startsWith("Digit") && code.length === 6) {
    return code.slice(5);
  }
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  if (code.startsWith("Numpad") && /^Numpad[0-9]$/.test(code)) {
    return `num${code.slice(6)}`;
  }
  return CODE_TO_KEY[code] ?? null;
}

/** Canonical Electron accelerator, or `null` if the combo is empty/invalid. */
export function normalizeHotkey(value: string | null | undefined): string | null {
  if (value == null) return null;
  const parts = value
    .split("+")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) return null;

  const modifiers = new Set<(typeof MODIFIER_ORDER)[number]>();
  let key: string | null = null;
  for (const part of parts) {
    const modifier = MODIFIER_ALIASES[part.toLowerCase()];
    if (modifier) {
      modifiers.add(modifier);
      continue;
    }
    if (key) return null;
    key = canonicalizeKey(part);
    if (!key) return null;
  }
  if (!key || modifiers.size === 0) return null;
  if (![...modifiers].some((mod) => mod !== "Shift")) return null;

  const ordered = MODIFIER_ORDER.filter((mod) => modifiers.has(mod));
  return [...ordered, key].join("+");
}

export function acceleratorFromKeyboardEvent(
  event: HotkeyKeyEvent,
): string | null {
  if (["Control", "Shift", "Alt", "Meta", "AltGraph"].includes(event.key)) {
    return null;
  }
  const key = keyFromCode(event.code) ?? canonicalizeKey(event.key);
  if (!key) return null;
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("CommandOrControl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  parts.push(key);
  return normalizeHotkey(parts.join("+"));
}

export function formatHotkey(accelerator: string | null | undefined): string {
  if (!accelerator) return "";
  const normalized = normalizeHotkey(accelerator) ?? accelerator;
  return normalized
    .split("+")
    .map((part) => DISPLAY_KEYS[part] ?? part)
    .join("+");
}
