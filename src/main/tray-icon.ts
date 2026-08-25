import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { nativeImage, type NativeImage } from "electron";
import { getResourcesDir } from "../shared/paths.js";

function crc32(buf: Buffer): number {
  let c = 0xffff_ffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (0xedb8_8320 ^ (c >>> 1)) : c >>> 1;
    }
  }
  return (c ^ 0xffff_ffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * stride, y * stride + stride);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function blendPixel(
  rgba: Buffer,
  size: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a: number,
): void {
  if (x < 0 || y < 0 || x >= size || y >= size || a <= 0) return;
  const i = (y * size + x) * 4;
  const srcA = a / 255;
  const dstA = (rgba[i + 3] ?? 0) / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;
  const mix = (src: number, dst: number): number =>
    (src * srcA + dst * dstA * (1 - srcA)) / outA;
  rgba[i] = mix(r, rgba[i] ?? 0);
  rgba[i + 1] = mix(g, rgba[i + 1] ?? 0);
  rgba[i + 2] = mix(b, rgba[i + 2] ?? 0);
  rgba[i + 3] = Math.round(outA * 255);
}

function setPixel(
  rgba: Buffer,
  size: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): void {
  blendPixel(rgba, size, x, y, r, g, b, a);
}

function fillCircle(
  rgba: Buffer,
  size: number,
  cx: number,
  cy: number,
  radius: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): void {
  const x0 = Math.floor(cx - radius - 1);
  const x1 = Math.ceil(cx + radius + 1);
  const y0 = Math.floor(cy - radius - 1);
  const y1 = Math.ceil(cy + radius + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      const coverage = Math.max(0, Math.min(1, radius + 0.5 - d));
      if (coverage > 0) {
        blendPixel(rgba, size, x, y, r, g, b, Math.round(a * coverage));
      }
    }
  }
}

function strokeCircle(
  rgba: Buffer,
  size: number,
  cx: number,
  cy: number,
  radius: number,
  thickness: number,
  r: number,
  g: number,
  b: number,
): void {
  const outer = radius + thickness / 2;
  const inner = Math.max(0, radius - thickness / 2);
  const x0 = Math.floor(cx - outer - 1);
  const x1 = Math.ceil(cx + outer + 1);
  const y0 = Math.floor(cy - outer - 1);
  const y1 = Math.ceil(cy + outer + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const coverage = Math.min(
        Math.max(0, Math.min(1, outer + 0.5 - d)),
        Math.max(0, Math.min(1, d - (inner - 0.5))),
      );
      if (coverage > 0) {
        blendPixel(rgba, size, x, y, r, g, b, Math.round(255 * coverage));
      }
    }
  }
}

function drawLine(
  rgba: Buffer,
  size: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thickness: number,
  r: number,
  g: number,
  b: number,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len * 2));
  const radius = thickness / 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillCircle(rgba, size, x0 + dx * t, y0 + dy * t, radius, r, g, b);
  }
}

/** Lucide `scissors` in a 24×24 viewBox, mapped into the icon. */
function drawScissors(
  rgba: Buffer,
  size: number,
  r: number,
  g: number,
  b: number,
): void {
  const pad = size * 0.2;
  const scale = (size - pad * 2) / 24;
  const map = (n: number): number => pad + n * scale;
  const stroke = Math.max(1.4, size * 0.075);

  strokeCircle(rgba, size, map(6), map(6), 3 * scale, stroke, r, g, b);
  strokeCircle(rgba, size, map(6), map(18), 3 * scale, stroke, r, g, b);
  drawLine(rgba, size, map(8.12), map(8.12), map(12), map(12), stroke, r, g, b);
  drawLine(rgba, size, map(20), map(4), map(8.12), map(15.88), stroke, r, g, b);
  drawLine(rgba, size, map(14.8), map(14.8), map(20), map(20), stroke, r, g, b);
}

const DIGITS: Record<string, number[]> = {
  "0": [0b111, 0b101, 0b101, 0b101, 0b111],
  "1": [0b010, 0b110, 0b010, 0b010, 0b111],
  "2": [0b111, 0b001, 0b111, 0b100, 0b111],
  "3": [0b111, 0b001, 0b111, 0b001, 0b111],
  "4": [0b101, 0b101, 0b111, 0b001, 0b001],
  "5": [0b111, 0b100, 0b111, 0b001, 0b111],
  "6": [0b111, 0b100, 0b111, 0b101, 0b111],
  "7": [0b111, 0b001, 0b010, 0b010, 0b010],
  "8": [0b111, 0b101, 0b111, 0b101, 0b111],
  "9": [0b111, 0b101, 0b111, 0b001, 0b111],
  "+": [0b000, 0b010, 0b111, 0b010, 0b000],
};

function drawDigit(
  rgba: Buffer,
  size: number,
  ox: number,
  oy: number,
  ch: string,
  r: number,
  g: number,
  b: number,
): void {
  const rows = DIGITS[ch];
  if (!rows) return;
  for (let y = 0; y < 5; y++) {
    const bits = rows[y]!;
    for (let x = 0; x < 3; x++) {
      if (bits & (1 << (2 - x))) {
        setPixel(rgba, size, ox + x, oy + y, r, g, b);
      }
    }
  }
}

function drawBadge(rgba: Buffer, size: number, badgeCount: number): void {
  if (badgeCount <= 0) return;
  const label = badgeCount > 9 ? "9+" : String(badgeCount);
  const badgeR = label.length > 1 ? 9 : 8;
  const bx = size - badgeR - 1;
  const by = badgeR;
  fillCircle(rgba, size, bx, by, badgeR, 220, 50, 70);
  fillCircle(rgba, size, bx, by, badgeR - 1, 255, 70, 90);

  if (label === "9+") {
    drawDigit(rgba, size, bx - 5, by - 2, "9", 255, 255, 255);
    drawDigit(rgba, size, bx - 1, by - 2, "+", 255, 255, 255);
  } else {
    drawDigit(rgba, size, bx - 1, by - 2, label, 255, 255, 255);
  }
}

function downsample(
  src: Buffer,
  srcSize: number,
  dstSize: number,
): Buffer {
  const factor = srcSize / dstSize;
  const dst = Buffer.alloc(dstSize * dstSize * 4);
  for (let y = 0; y < dstSize; y++) {
    for (let x = 0; x < dstSize; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      const x0 = Math.floor(x * factor);
      const y0 = Math.floor(y * factor);
      const x1 = Math.floor((x + 1) * factor);
      const y1 = Math.floor((y + 1) * factor);
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * srcSize + sx) * 4;
          r += src[i] ?? 0;
          g += src[i + 1] ?? 0;
          b += src[i + 2] ?? 0;
          a += src[i + 3] ?? 0;
          count += 1;
        }
      }
      const di = (y * dstSize + x) * 4;
      dst[di] = Math.round(r / count);
      dst[di + 1] = Math.round(g / count);
      dst[di + 2] = Math.round(b / count);
      dst[di + 3] = Math.round(a / count);
    }
  }
  return dst;
}

function renderScissorsPng(size: number, badgeCount = 0): Buffer {
  const scale = size >= 64 ? 2 : 4;
  const srcSize = size * scale;
  const rgba = Buffer.alloc(srcSize * srcSize * 4, 0);
  fillCircle(rgba, srcSize, srcSize / 2, srcSize / 2, srcSize / 2 - scale, 23, 28, 40);
  drawScissors(rgba, srcSize, 245, 247, 250);
  const down = downsample(rgba, srcSize, size);
  drawBadge(down, size, badgeCount);
  return encodePng(size, size, down);
}

function fromPng(png: Buffer): NativeImage {
  return nativeImage.createFromBuffer(png);
}

function logoPath(): string {
  return path.join(getResourcesDir(), "logo.png");
}

function loadLogo(): NativeImage | null {
  const file = logoPath();
  if (!fs.existsSync(file)) return null;
  const img = nativeImage.createFromPath(file);
  return img.isEmpty() ? null : img;
}

/** Electron `toBitmap()` is BGRA on little-endian (Windows). */
function bitmapToRgba(img: NativeImage): { rgba: Buffer; size: number } {
  const { width, height } = img.getSize();
  const bgra = img.toBitmap();
  const size = Math.min(width, height);
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const src = (y * width + x) * 4;
      const dst = (y * size + x) * 4;
      rgba[dst] = bgra[src + 2]!;
      rgba[dst + 1] = bgra[src + 1]!;
      rgba[dst + 2] = bgra[src]!;
      rgba[dst + 3] = bgra[src + 3]!;
    }
  }
  return { rgba, size };
}

const TRAY_SIZE = 32;

/** badgeCount: 0 = no badge, 1–9 = digit, >=10 = "9+" */
function buildTrayIcon(badgeCount: number): NativeImage {
  const logo = loadLogo();
  if (!logo) {
    return fromPng(renderScissorsPng(TRAY_SIZE, badgeCount));
  }
  const resized = logo.resize({
    width: TRAY_SIZE,
    height: TRAY_SIZE,
    quality: "best",
  });
  if (badgeCount <= 0) return resized;
  const { rgba, size } = bitmapToRgba(resized);
  drawBadge(rgba, size, badgeCount);
  return fromPng(encodePng(size, size, rgba));
}

const trayCache = new Map<number, NativeImage>();
let appIcon: NativeImage | null = null;

export function getTrayIcon(unnamedCount: number): NativeImage {
  const key = unnamedCount <= 0 ? 0 : unnamedCount > 9 ? 10 : unnamedCount;
  let icon = trayCache.get(key);
  if (!icon) {
    icon = buildTrayIcon(key === 10 ? 10 : key);
    trayCache.set(key, icon);
  }
  return icon;
}

export function getAppIcon(): NativeImage {
  if (!appIcon) {
    appIcon = loadLogo() ?? fromPng(renderScissorsPng(256));
  }
  return appIcon;
}
