/*
 * Generates the PWA PNG app icons (a white water drop on brand blue) for the
 * technician app. Pure Node — only the built-in `zlib` is used to deflate the
 * PNG IDAT, so this runs anywhere with no extra dependencies.
 *
 *   node scripts/gen-pwa-icons.mjs
 *
 * Outputs to public/icons/: icon-192.png, icon-512.png, icon-180.png (Apple
 * touch icon) and maskable-512.png (extra safe-zone padding for Android masks).
 */
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

const BLUE = [0x1a, 0x56, 0xdb];
const WHITE = [0xff, 0xff, 0xff];

// ── PNG encoding ────────────────────────────────────────────────────────────
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.subarray(y * stride, y * stride + stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ── Water-drop drawing (2× supersampled for clean edges) ────────────────────
function sign(ax, ay, bx, by, cx, cy) {
  return (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
}

function drawDrop(size, { rBulb, cyB, apexY }) {
  const ss = 2;
  const M = size * ss;
  const cx = M / 2;
  const r = rBulb * M;
  const cyb = cyB * M;
  const ax = cx, ay = apexY * M; // apex
  const blx = cx - r, bly = cyb; // bottom-left of triangle / circle edge
  const brx = cx + r, bry = cyb; // bottom-right

  const inCircle = (px, py) => (px - cx) ** 2 + (py - cyb) ** 2 <= r * r;
  const inTri = (px, py) => {
    const d1 = sign(px, py, ax, ay, blx, bly);
    const d2 = sign(px, py, blx, bly, brx, bry);
    const d3 = sign(px, py, brx, bry, ax, ay);
    const neg = d1 < 0 || d2 < 0 || d3 < 0;
    const pos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(neg && pos);
  };

  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cov = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const px = x * ss + sx + 0.5;
          const py = y * ss + sy + 0.5;
          if (inCircle(px, py) || inTri(px, py)) cov++;
        }
      }
      cov /= ss * ss;
      const i = (y * size + x) * 4;
      out[i] = Math.round(BLUE[0] * (1 - cov) + WHITE[0] * cov);
      out[i + 1] = Math.round(BLUE[1] * (1 - cov) + WHITE[1] * cov);
      out[i + 2] = Math.round(BLUE[2] * (1 - cov) + WHITE[2] * cov);
      out[i + 3] = 255;
    }
  }
  return out;
}

// Normal icon: drop fills most of the canvas. Maskable: smaller, inside the
// ~80% safe zone so OS masks don't clip it.
const NORMAL = { rBulb: 0.26, cyB: 0.62, apexY: 0.16 };
const MASKABLE = { rBulb: 0.2, cyB: 0.58, apexY: 0.24 };

const outDir = path.join(process.cwd(), "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  ["icon-192.png", 192, NORMAL],
  ["icon-512.png", 512, NORMAL],
  ["icon-180.png", 180, NORMAL],
  ["maskable-512.png", 512, MASKABLE],
];

for (const [file, size, shape] of targets) {
  const png = encodePNG(size, drawDrop(size, shape));
  fs.writeFileSync(path.join(outDir, file), png);
  console.log(`wrote public/icons/${file} (${size}x${size}, ${png.length} bytes)`);
}
