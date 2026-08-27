import fs, { createReadStream } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import { net, protocol } from "electron";
import { findClip, thumbnailsDir } from "../shared/clips/index.js";
import { videoMime } from "./clips/urls.js";
import { getAppDataDir } from "./session.js";

const mediaPrivileges = {
  standard: true,
  secure: true,
  supportFetchAPI: true,
  bypassCSP: true,
  stream: true,
} as const;

/**
 * Must run before `app.ready`. Privileged schemes cannot be added later.
 */
export function registerPrivilegedSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: "thumb", privileges: { ...mediaPrivileges } },
    { scheme: "media", privileges: { ...mediaPrivileges } },
  ]);
}

function serveMediaFile(filePath: string, request: Request): Response {
  const { size } = fs.statSync(filePath);
  const type = videoMime(filePath);
  const rangeHeader = request.headers.get("range");
  let start = 0;
  let end = size - 1;
  let status = 200;

  if (rangeHeader) {
    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (!match) {
      return new Response("Invalid Range", { status: 416 });
    }
    start = match[1] ? Number(match[1]) : 0;
    end = match[2] ? Number(match[2]) : size - 1;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      start >= size ||
      start > end
    ) {
      return new Response("Range Not Satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    end = Math.min(end, size - 1);
    status = 206;
  }

  const stream = createReadStream(filePath, { start, end });
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Content-Length": String(end - start + 1),
    "Accept-Ranges": "bytes",
  };
  if (status === 206) {
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status,
    headers,
  });
}

export function registerMediaProtocolHandlers(): void {
  protocol.handle("thumb", (request) => {
    try {
      const url = new URL(request.url);
      const id = decodeURIComponent(
        url.pathname.replace(/^\//, "").replace(/\.jpg$/i, ""),
      );
      if (!id || id.includes("..") || id.includes("/") || id.includes("\\")) {
        return new Response("Bad Request", { status: 400 });
      }
      const file = join(thumbnailsDir(getAppDataDir()), `${id}.jpg`);
      if (!fs.existsSync(file)) {
        return new Response("Not Found", { status: 404 });
      }
      return net.fetch(pathToFileURL(file).toString());
    } catch {
      return new Response("Error", { status: 500 });
    }
  });

  protocol.handle("media", (request) => {
    try {
      const url = new URL(request.url);
      const id = decodeURIComponent(
        url.pathname.replace(/^\//, "").replace(/\/$/, ""),
      );
      if (!id || id.includes("..") || id.includes("/") || id.includes("\\")) {
        return new Response("Bad Request", { status: 400 });
      }
      const clip = findClip(getAppDataDir(), id);
      if (!clip?.filePath || !fs.existsSync(clip.filePath)) {
        return new Response("Not Found", { status: 404 });
      }
      return serveMediaFile(clip.filePath, request);
    } catch {
      return new Response("Error", { status: 500 });
    }
  });
}
