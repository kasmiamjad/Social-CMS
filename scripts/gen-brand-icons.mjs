/*
 * Generates the PWA app icons from the SA'DA H2O emblem (brand-assets/sada-mark.png):
 * the white mark composited on the brand sky-blue, in 192/512/180 + a maskable
 * 512 with extra padding. Pure Node (zlib) — decodes the source PNG, extracts the
 * dark-mark coverage, scales it, and re-encodes. No image dependencies.
 *
 *   node scripts/gen-brand-icons.mjs
 */
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

const BG = [0x0e, 0xa5, 0xe9]; // sky-blue --accent
const FG = [0xff, 0xff, 0xff]; // white mark

// ── PNG decode (8-bit, colour types 0/2/4/6, filters 0–4) ───────────────────
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodePNG(buf) {
  let off = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`only 8-bit PNG supported (got ${bitDepth})`);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : colorType === 4 ? 2 : 0;
  if (!channels) throw new Error(`unsupported colorType ${colorType}`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const cur = new Uint8Array(stride);
  const prev = new Uint8Array(stride);
  const rgba = new Uint8Array(width * height * 4);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    for (let x = 0; x < stride; x++) {
      const rb = raw[pos++];
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v;
      switch (filter) {
        case 0: v = rb; break;
        case 1: v = rb + a; break;
        case 2: v = rb + b; break;
        case 3: v = rb + ((a + b) >> 1); break;
        case 4: v = rb + paeth(a, b, c); break;
        default: throw new Error(`bad filter ${filter}`);
      }
      cur[x] = v & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (channels === 4) {
        rgba[i] = cur[x * 4]; rgba[i + 1] = cur[x * 4 + 1]; rgba[i + 2] = cur[x * 4 + 2]; rgba[i + 3] = cur[x * 4 + 3];
      } else if (channels === 3) {
        rgba[i] = cur[x * 3]; rgba[i + 1] = cur[x * 3 + 1]; rgba[i + 2] = cur[x * 3 + 2]; rgba[i + 3] = 255;
      } else if (channels === 1) {
        const g = cur[x]; rgba[i] = g; rgba[i + 1] = g; rgba[i + 2] = g; rgba[i + 3] = 255;
      } else {
        const g = cur[x * 2]; rgba[i] = g; rgba[i + 1] = g; rgba[i + 2] = g; rgba[i + 3] = cur[x * 2 + 1];
      }
    }
    prev.set(cur);
  }
  return { width, height, rgba };
}

// Coverage = how "mark" a pixel is. Works whether the source is a dark mark on a
// transparent bg (use alpha) or on an opaque white bg (use darkness).
function buildCoverage(src) {
  const cov = new Float32Array(src.width * src.height);
  for (let i = 0; i < src.width * src.height; i++) {
    const r = src.rgba[i * 4], g = src.rgba[i * 4 + 1], b = src.rgba[i * 4 + 2], a = src.rgba[i * 4 + 3] / 255;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    cov[i] = a * (1 - lum);
  }
  return cov;
}

function sampleCov(cov, w, h, x, y) {
  if (x < 0 || y < 0 || x >= w || y >= h) return 0;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const top = cov[y0 * w + x0] * (1 - fx) + cov[y0 * w + x1] * fx;
  const bot = cov[y1 * w + x0] * (1 - fx) + cov[y1 * w + x1] * fx;
  return top * (1 - fy) + bot * fy;
}

// ── PNG encode (RGBA) ───────────────────────────────────────────────────────
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const tb = Buffer.from(type, "ascii"); const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, crc]);
}
function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) { raw[y * (stride + 1)] = 0; rgba.subarray(y * stride, y * stride + stride).copy(raw, y * (stride + 1) + 1); }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function makeIcon(src, cov, size, pad) {
  const inner = size * pad;
  const scale = Math.max(src.width, src.height) / inner; // source px per output px
  const offX = (size - (src.width / scale)) / 2;
  const offY = (size - (src.height / scale)) / 2;
  const out = Buffer.alloc(size * size * 4);
  const ss = 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let c = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const ox = x + (sx + 0.5) / ss - 0.5;
          const oy = y + (sy + 0.5) / ss - 0.5;
          c += sampleCov(cov, src.width, src.height, (ox - offX) * scale, (oy - offY) * scale);
        }
      }
      c = Math.min(1, c / (ss * ss));
      const i = (y * size + x) * 4;
      out[i] = Math.round(BG[0] * (1 - c) + FG[0] * c);
      out[i + 1] = Math.round(BG[1] * (1 - c) + FG[1] * c);
      out[i + 2] = Math.round(BG[2] * (1 - c) + FG[2] * c);
      out[i + 3] = 255;
    }
  }
  return out;
}

const src = decodePNG(fs.readFileSync(path.join(process.cwd(), "brand-assets", "sada-mark.png")));
const cov = buildCoverage(src);
const outDir = path.join(process.cwd(), "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  ["icon-192.png", 192, 0.72],
  ["icon-512.png", 512, 0.72],
  ["icon-180.png", 180, 0.72],
  ["maskable-512.png", 512, 0.58],
];
for (const [file, size, pad] of targets) {
  const png = encodePNG(size, makeIcon(src, cov, size, pad));
  fs.writeFileSync(path.join(outDir, file), png);
  console.log(`wrote public/icons/${file} (${size}x${size}, ${png.length} bytes)`);
}
