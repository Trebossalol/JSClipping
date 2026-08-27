import { extname } from "node:path";
import type { ClipRecord } from "../../shared/ipc.js";

export function withClipUrls(clips: ClipRecord[]): ClipRecord[] {
  return clips.map((clip) => ({
    ...clip,
    thumbnailPath: clip.thumbnailPath ? `thumb://clip/${clip.id}.jpg` : null,
    mediaUrl: `media://clip/${clip.id}`,
  }));
}

export function videoMime(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case ".webm":
      return "video/webm";
    case ".mkv":
      return "video/x-matroska";
    case ".mov":
      return "video/quicktime";
    case ".m4v":
      return "video/x-m4v";
    default:
      return "video/mp4";
  }
}
