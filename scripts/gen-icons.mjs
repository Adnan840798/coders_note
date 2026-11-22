/**
 * gen-icons.mjs — generates build/icon.png (512x512), build/icon.ico (multi-res),
 * and build/tray-icon.png (32x32) using pure Node.js (no external deps).
 *
 * Icon design: dark navy background + "CN" monogram in white,
 * matching the Coders Note brand palette.
 */

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BUILD = join(__dirname, '..', 'build')

// ─── Minimal PNG encoder ──────────────────────────────────────────────────────

function adler32(buf) {
  let a = 1, b = 0
  for (const byte of buf) { a = (a + byte) % 65521; b = (b + a) % 65521 }
  return (b << 16) | a
}

function crc32(buf) {
  const table = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  let crc = 0xFFFFFFFF
  for (const b of buf) crc = table[(crc ^ b) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function u32be(n) {
  const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b
}

function deflateRaw(data) {
  // zlib deflate: 1-byte blocks (store method, no compression) for simplicity
  const chunks = []
  const BSIZE = 32768
  for (let i = 0; i < data.length; i += BSIZE) {
    const chunk = data.slice(i, i + BSIZE)
    const last = i + BSIZE >= data.length ? 1 : 0
    chunks.push(Buffer.from([last, chunk.length & 0xFF, (chunk.length >> 8) & 0xFF,
      (~chunk.length) & 0xFF, ((~chunk.length) >> 8) & 0xFF]))
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function zlib(data) {
  const raw = deflateRaw(data)
  const adler = adler32(data)
  return Buffer.concat([
    Buffer.from([0x78, 0x01]),  // zlib header: deflate, default compression
    raw,
    u32be(adler)
  ])
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const crcData = Buffer.concat([typeBytes, data])
  return Buffer.concat([u32be(data.length), typeBytes, data, u32be(crc32(crcData))])
}

function makePNG(pixels, size) {
  // pixels: Uint8Array of size*size*4 (RGBA)
  const header = Buffer.from('\x89PNG\r\n\x1a\n', 'binary')
  const ihdr = pngChunk('IHDR', Buffer.concat([
    u32be(size), u32be(size),
    Buffer.from([8, 2, 0, 0, 0])  // 8-bit depth, RGB (no alpha in IHDR... but we store RGBA via filter)
  ]))
  // Build raw scanlines (filter byte 0 = None, then RGB pixels)
  const scanlines = []
  for (let y = 0; y < size; y++) {
    scanlines.push(0)  // filter type None
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      scanlines.push(pixels[i], pixels[i+1], pixels[i+2])
    }
  }
  const rawData = Buffer.from(scanlines)
  const idat = pngChunk('IDAT', zlib(rawData))
  const iend = pngChunk('IEND', Buffer.alloc(0))
  return Buffer.concat([header, ihdr, idat, iend])
}

// ─── Draw the icon ────────────────────────────────────────────────────────────

function drawIcon(size) {
  const pixels = new Uint8Array(size * size * 4)
  const cx = size / 2, cy = size / 2, r = size / 2

  // Brand colors
  const BG   = [26, 32, 56]       // #1A2038 — deep navy
  const FG   = [255, 255, 255]    // white monogram
  const ACC  = [99, 179, 237]     // #63B3ED — light blue accent ring

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const dx = x - cx, dy = y - cy
      const dist = Math.sqrt(dx*dx + dy*dy)

      if (dist > r) {
        // Transparent outside circle
        pixels[i] = pixels[i+1] = pixels[i+2] = pixels[i+3] = 0
        continue
      }

      // Accent ring (outer 4% of radius)
      if (dist > r * 0.96) {
        pixels[i] = ACC[0]; pixels[i+1] = ACC[1]; pixels[i+2] = ACC[2]; pixels[i+3] = 255
        continue
      }

      // Background fill
      pixels[i] = BG[0]; pixels[i+1] = BG[1]; pixels[i+2] = BG[2]; pixels[i+3] = 255

      // Draw "CN" monogram — simple pixel art scaled to icon size
      const nx = (x / size), ny = (y / size)  // normalized [0,1]
      const inGlyph = drawGlyph(nx, ny, size)
      if (inGlyph) {
        pixels[i] = FG[0]; pixels[i+1] = FG[1]; pixels[i+2] = FG[2]; pixels[i+3] = 255
      }
    }
  }
  return pixels
}

function drawGlyph(nx, ny, size) {
  // "CN" letters, centered in the lower 70% of icon, slightly left of center
  const thick = Math.max(0.03, 48 / size)  // stroke width scales with icon

  // ── C (left half) ──
  const cCx = 0.37, cCy = 0.50, cRx = 0.14, cRy = 0.20
  // Check if point is on the C arc (left-side open circle outline)
  const cDx = (nx - cCx) / cRx, cDy = (ny - cCy) / cRy
  const cDist = Math.sqrt(cDx*cDx + cDy*cDy)
  const onC = Math.abs(cDist - 1) < thick / 0.14
  const openAngle = Math.atan2(cDy, cDx)  // in [-π, π]
  const isOpen = openAngle > -0.6 && openAngle < 0.6  // right gap of C
  if (onC && !isOpen) return true

  // ── N (right half) ──
  const nL = 0.56, nR = 0.80, nT = 0.30, nB = 0.70
  // Left vertical bar of N
  if (nx >= nL && nx <= nL + thick && ny >= nT && ny <= nB) return true
  // Right vertical bar of N
  if (nx >= nR - thick && nx <= nR && ny >= nT && ny <= nB) return true
  // Diagonal stroke of N
  const diagFrac = (ny - nT) / (nB - nT)
  const diagX = nL + (nR - nL) * diagFrac
  if (ny >= nT && ny <= nB && Math.abs(nx - diagX) < thick) return true

  return false
}

// ─── Build PNG buffers ────────────────────────────────────────────────────────

function buildPng(size) {
  return makePNG(drawIcon(size), size)
}

// ─── Build ICO (multi-resolution) ─────────────────────────────────────────────
// ICO format: header + directory entries + PNG data blobs (modern ICO supports embedded PNG)

function buildIco(sizes) {
  const pngs = sizes.map(s => buildPng(s))

  // ICONDIR header
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)       // reserved
  header.writeUInt16LE(1, 2)       // type: 1 = ICO
  header.writeUInt16LE(sizes.length, 4)

  // Directory entries (16 bytes each)
  const dirSize = sizes.length * 16
  const dataOffset = 6 + dirSize
  const dirs = []
  let offset = dataOffset
  for (let i = 0; i < sizes.length; i++) {
    const entry = Buffer.alloc(16)
    const s = sizes[i]
    entry[0] = s >= 256 ? 0 : s   // width (0 = 256)
    entry[1] = s >= 256 ? 0 : s   // height
    entry[2] = 0                   // color count
    entry[3] = 0                   // reserved
    entry.writeUInt16LE(1, 4)      // planes
    entry.writeUInt16LE(32, 6)     // bit count
    entry.writeUInt32LE(pngs[i].length, 8)
    entry.writeUInt32LE(offset, 12)
    dirs.push(entry)
    offset += pngs[i].length
  }

  return Buffer.concat([header, ...dirs, ...pngs])
}

// ─── Write files ──────────────────────────────────────────────────────────────

const icon512 = buildPng(512)
writeFileSync(join(BUILD, 'icon.png'), icon512)
console.log('✓ build/icon.png  (512×512)')

const trayIcon = buildPng(32)
writeFileSync(join(BUILD, 'tray-icon.png'), trayIcon)
console.log('✓ build/tray-icon.png  (32×32)')

const ico = buildIco([16, 32, 48, 256])
writeFileSync(join(BUILD, 'icon.ico'), ico)
console.log('✓ build/icon.ico  (16, 32, 48, 256 px)')

console.log('\nAll icons generated successfully in build/')
