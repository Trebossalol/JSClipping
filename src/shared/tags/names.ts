import type { ClipRecord } from "../ipc.js";

export const MAX_TAG_NAME_LENGTH = 40;

/** Trim and collapse inner whitespace. */
export function normalizeTagName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function clipTagIds(clip: Pick<ClipRecord, "tagIds">): string[] {
  if (!Array.isArray(clip.tagIds)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of clip.tagIds) {
    if (typeof id !== "string" || !id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
