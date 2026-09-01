import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { TagRecord } from "../ipc.js";
import { ensureDir } from "../paths.js";
import { readStore, writeStore } from "../clips/store.js";
import { clipTagIds, MAX_TAG_NAME_LENGTH, normalizeTagName } from "./names.js";

function tagsJsonPath(appDataDir: string): string {
  return path.join(appDataDir, "tags.json");
}

export function readTags(appDataDir: string): TagRecord[] {
  const file = tagsJsonPath(appDataDir);
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as TagRecord[];
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item): item is TagRecord =>
        Boolean(
          item &&
            typeof item === "object" &&
            typeof item.id === "string" &&
            item.id &&
            typeof item.name === "string" &&
            typeof item.createdAt === "string",
        ),
    );
  } catch {
    return [];
  }
}

export function writeTags(appDataDir: string, tags: TagRecord[]): void {
  ensureDir(appDataDir);
  fs.writeFileSync(tagsJsonPath(appDataDir), JSON.stringify(tags, null, 2), "utf8");
}

export function listTags(appDataDir: string): TagRecord[] {
  const tags = readTags(appDataDir);
  tags.sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
  return tags;
}

export function listTagIdSet(appDataDir: string): Set<string> {
  return new Set(readTags(appDataDir).map((tag) => tag.id));
}

export function sanitizeTagIds(
  appDataDir: string,
  ids: string[] | undefined,
): string[] {
  const known = listTagIdSet(appDataDir);
  return clipTagIds({ tagIds: ids }).filter((id) => known.has(id));
}

function validateTagName(
  name: string,
): { ok: true; name: string } | { ok: false; error: string } {
  const normalized = normalizeTagName(name);
  if (!normalized) {
    return { ok: false, error: "Bitte einen Tag-Namen eingeben." };
  }
  if (normalized.length > MAX_TAG_NAME_LENGTH) {
    return {
      ok: false,
      error: `Der Name darf höchstens ${MAX_TAG_NAME_LENGTH} Zeichen lang sein.`,
    };
  }
  return { ok: true, name: normalized };
}

function findDuplicate(
  tags: TagRecord[],
  name: string,
  exceptId?: string,
): TagRecord | undefined {
  const key = name.toLowerCase();
  return tags.find(
    (tag) => tag.id !== exceptId && tag.name.toLowerCase() === key,
  );
}

export function createTag(
  appDataDir: string,
  name: string,
): { ok: true; tag: TagRecord } | { ok: false; error: string } {
  const parsed = validateTagName(name);
  if (!parsed.ok) return parsed;

  const tags = readTags(appDataDir);
  if (findDuplicate(tags, parsed.name)) {
    return { ok: false, error: "Ein Tag mit diesem Namen existiert bereits." };
  }

  const tag: TagRecord = {
    id: crypto.randomUUID(),
    name: parsed.name,
    createdAt: new Date().toISOString(),
  };
  tags.push(tag);
  writeTags(appDataDir, tags);
  return { ok: true, tag };
}

export function renameTag(
  appDataDir: string,
  id: string,
  name: string,
): { ok: true; tag: TagRecord } | { ok: false; error: string } {
  const parsed = validateTagName(name);
  if (!parsed.ok) return parsed;

  const tags = readTags(appDataDir);
  const index = tags.findIndex((tag) => tag.id === id);
  if (index < 0) return { ok: false, error: "Tag nicht gefunden." };

  if (findDuplicate(tags, parsed.name, id)) {
    return { ok: false, error: "Ein Tag mit diesem Namen existiert bereits." };
  }

  const updated: TagRecord = { ...tags[index]!, name: parsed.name };
  tags[index] = updated;
  writeTags(appDataDir, tags);
  return { ok: true, tag: updated };
}

export function deleteTag(
  appDataDir: string,
  id: string,
): { ok: true } | { ok: false; error: string } {
  const tags = readTags(appDataDir);
  const index = tags.findIndex((tag) => tag.id === id);
  if (index < 0) return { ok: false, error: "Tag nicht gefunden." };

  tags.splice(index, 1);
  writeTags(appDataDir, tags);

  const clips = readStore(appDataDir);
  let changed = false;
  for (const clip of clips) {
    const current = clipTagIds(clip);
    const next = current.filter((tagId) => tagId !== id);
    if (next.length !== current.length) {
      clip.tagIds = next;
      changed = true;
    }
  }
  if (changed) writeStore(appDataDir, clips);

  return { ok: true };
}
