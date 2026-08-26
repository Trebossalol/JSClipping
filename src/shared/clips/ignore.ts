import path from "node:path";

/** Paths we renamed ourselves — watcher should ignore these. */
const ignoredPaths = new Set<string>();
const importingPaths = new Set<string>();

function pathKey(filePath: string): string {
  return path.normalize(filePath).toLowerCase();
}

export function ignorePathTemporarily(filePath: string, ms = 5000): void {
  const key = pathKey(filePath);
  ignoredPaths.add(key);
  setTimeout(() => ignoredPaths.delete(key), ms);
}

export function isIgnoredPath(filePath: string): boolean {
  return ignoredPaths.has(pathKey(filePath));
}

/** Returns false if this path is already being imported. */
export function beginImport(filePath: string): boolean {
  const key = pathKey(filePath);
  if (importingPaths.has(key)) return false;
  importingPaths.add(key);
  return true;
}

export function endImport(filePath: string): void {
  importingPaths.delete(pathKey(filePath));
}
