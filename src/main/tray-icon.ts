import zlib from "node:zlib";
import { nativeImage, type NativeImage } from "electron";

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
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  rgba[i] = r;
  rgba[i + 1] = g;
  rgba[i + 2] = b;
  rgba[i + 3] = a;
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
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      if (dx * dx + dy * dy <= r2) {
        setPixel(rgba, size, x, y, r, g, b, a);
      }
    }
  }
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

function drawClipGlyph(rgba: Buffer, size: number): void {
  fillCircle(rgba, size, size / 2, size / 2, size / 2 - 1, 23, 28, 40);
  fillCircle(rgba, size, size / 2 - 2, size / 2 - 1, size / 4, 91, 140, 255);
  fillCircle(rgba, size, size / 2 + 4, size / 2 + 3, size / 6, 62, 207, 142);
}

/** badgeCount: 0 = no badge, 1–9 = digit, >=10 = "9+" */
function buildIcon(badgeCount: number): NativeImage {
  const size = 32;
  const rgba = Buffer.alloc(size * size * 4, 0);
  drawClipGlyph(rgba, size);

  if (badgeCount > 0) {
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

  return nativeImage.createFromBuffer(encodePng(size, size, rgba));
}

const iconCache = new Map<number, NativeImage>();

export function getTrayIcon(unnamedCount: number): NativeImage {
  const key = unnamedCount <= 0 ? 0 : unnamedCount > 9 ? 10 : unnamedCount;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = buildIcon(key === 10 ? 10 : key);
    iconCache.set(key, icon);
  }
  return icon;
}
