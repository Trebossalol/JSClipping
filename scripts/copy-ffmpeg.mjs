import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destDir = path.join(root, "resources", "ffmpeg");

const ffmpeg = require("ffmpeg-static");
const ffprobe = require("ffprobe-static");
const ffprobePath = typeof ffprobe === "string" ? ffprobe : ffprobe?.path;

if (!ffmpeg || !fs.existsSync(ffmpeg)) {
  throw new Error(`ffmpeg-static binary missing: ${ffmpeg}`);
}
if (!ffprobePath || !fs.existsSync(ffprobePath)) {
  throw new Error(`ffprobe-static binary missing: ${ffprobePath}`);
}

fs.mkdirSync(destDir, { recursive: true });
const ffmpegDest = path.join(destDir, "ffmpeg.exe");
const ffprobeDest = path.join(destDir, "ffprobe.exe");
fs.copyFileSync(ffmpeg, ffmpegDest);
fs.copyFileSync(ffprobePath, ffprobeDest);

console.log(`Copied ffmpeg  -> ${ffmpegDest}`);
console.log(`Copied ffprobe -> ${ffprobeDest}`);
