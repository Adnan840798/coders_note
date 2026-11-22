/**
 * scripts/gen-icons.mjs
 * Generates production-quality desktop icons for Coders Note using
 * pure Node.js (zlib + PNG + ICO) with Signed Distance Field (SDF) anti-aliasing.
 *
 * Emits:
 *   - build/icon.png (512x512 RGBA high-res)
 *   - build/icon.ico (Windows multi-resolution ICO: 16, 32, 48, 64, 128, 256 px)
 *   - build/tray-icon.png (32x32 clean tray icon)
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import zlib from 'zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BUILD = join(__dirname, '..', 'build')
mkdirSync(BUILD, { recursive: true })

// ─── PNG & ICO Binary Builders ────────────────────────────────────────────────

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
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n >>> 0, 0)
  return b
}

function makePngBuffer(pixels, width, height) {
  // pixels: Uint8Array [r, g, b, a, ...] length = width * height * 4
  const scanlines = Buffer.alloc(height * (1 + width * 4))
  let srcOffset = 0
  let dstOffset = 0

  for (let y = 0; y < height; y++) {
    scanlines[dstOffset++] = 0 // Filter type None
    for (let x = 0; x < width; x++) {
      scanlines[dstOffset++] = pixels[srcOffset++] // R
      scanlines[dstOffset++] = pixels[srcOffset++] // G
      scanlines[dstOffset++] = pixels[srcOffset++] // B
      scanlines[dstOffset++] = pixels[srcOffset++] // A
    }
  }

  const compressed = zlib.deflateSync(scanlines, { level: 9 })

  function chunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii')
    const lenBuf = u32be(data.length)
    const crcBuf = u32be(crc32(Buffer.concat([typeBuf, data])))
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
  }

  const header = Buffer.from('\x89PNG\r\n\x1a\n', 'binary')
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8  // Bit depth 8
  ihdrData[9] = 6  // Color type 6 (RGBA)
  ihdrData[10] = 0 // Compression method
  ihdrData[11] = 0 // Filter method
  ihdrData[12] = 0 // Interlace method

  const ihdr = chunk('IHDR', ihdrData)
  const idat = chunk('IDAT', compressed)
  const iend = chunk('IEND', Buffer.alloc(0))

  return Buffer.concat([header, ihdr, idat, iend])
}

function makeIcoBuffer(pngBuffers, sizes) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: 1 = ICO
  header.writeUInt16LE(sizes.length, 4) // count

  const dirEntries = []
  let offset = 6 + sizes.length * 16

  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i]
    const buf = pngBuffers[i]
    const entry = Buffer.alloc(16)
    entry[0] = s >= 256 ? 0 : s // width (0 = 256)
    entry[1] = s >= 256 ? 0 : s // height (0 = 256)
    entry[2] = 0 // color count
    entry[3] = 0 // reserved
    entry.writeUInt16LE(1, 4) // color planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(buf.length, 8) // size of image data
    entry.writeUInt32LE(offset, 12) // offset
    dirEntries.push(entry)
    offset += buf.length
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers])
}

// ─── 2D SDF Drawing Utilities ────────────────────────────────────────────────

function length(x, y) {
  return Math.sqrt(x * x + y * y)
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

// Distance to rounded rectangle (box half size [bx, by], corner radius r)
function sdRoundedBox(px, py, bx, by, r) {
  const qx = Math.abs(px) - bx + r
  const qy = Math.abs(py) - by + r
  return Math.min(Math.max(qx, qy), 0) + length(Math.max(qx, 0), Math.max(qy, 0)) - r
}

// Distance to line segment a -> b with radius
function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay
  const bax = bx - ax, bay = by - ay
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1)
  const dx = pax - bax * h
  const dy = pay - bay * h
  return length(dx, dy)
}

// Blend colors (alpha over)
function blend(bg, fg, alpha) {
  const a = clamp(alpha, 0, 1)
  const outA = fg[3] * a + bg[3] * (1 - a)
  if (outA <= 0) return [0, 0, 0, 0]
  return [
    Math.round((fg[0] * a + bg[0] * (1 - a))),
    Math.round((fg[1] * a + bg[1] * (1 - a))),
    Math.round((fg[2] * a + bg[2] * (1 - a))),
    Math.round(clamp(outA, 0, 255)),
  ]
}

// ─── App Icon Renderer ────────────────────────────────────────────────────────

function renderIcon(size, isTray = false) {
  const pixels = new Uint8Array(size * size * 4)
  const aa = 1.5 / size // Anti-aliasing transition range in normalized [0, 1] coords

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4

      // Normalized coordinates: center at (0, 0), span [-0.5, 0.5]
      const nx = (x + 0.5) / size - 0.5
      const ny = (y + 0.5) / size - 0.5

      let col = [0, 0, 0, 0] // start transparent

      if (isTray) {
        // Tray icon: clean, minimal, monochrome/amber silhouette
        // Just code brackets < / >
        const leftBracketD = Math.min(
          sdSegment(nx, ny, -0.15, -0.22, -0.32, 0.0),
          sdSegment(nx, ny, -0.32, 0.0, -0.15, 0.22)
        ) - 0.045

        const rightBracketD = Math.min(
          sdSegment(nx, ny, 0.15, -0.22, 0.32, 0.0),
          sdSegment(nx, ny, 0.32, 0.0, 0.15, 0.22)
        ) - 0.045

        const slashD = sdSegment(nx, ny, 0.09, -0.26, -0.09, 0.26) - 0.042

        const dMin = Math.min(leftBracketD, rightBracketD, slashD)
        const alpha = 1.0 - smoothstep(-aa, aa, dMin)
        if (alpha > 0) {
          pixels[idx]     = 249 // Orange-amber #F97316
          pixels[idx + 1] = 115
          pixels[idx + 2] = 22
          pixels[idx + 3] = Math.round(alpha * 255)
        }
        continue
      }

      // ── Main App Icon ───────────────────────────────────────────────────────
      // 1. Squircle background plate
      const boxD = sdRoundedBox(nx, ny, 0.42, 0.42, 0.12)
      const boxMask = 1.0 - smoothstep(-aa, aa, boxD)

      if (boxMask > 0) {
        // Subtle vertical gradient on dark slate tile: #1E293B (top) -> #0F172A (bottom)
        const gradT = clamp(ny + 0.5, 0, 1)
        const bgR = Math.round(30 - gradT * 15)
        const bgG = Math.round(41 - gradT * 18)
        const bgB = Math.round(59 - gradT * 17)
        col = [bgR, bgG, bgB, Math.round(boxMask * 255)]

        // Subtle warm glow in the upper center
        const glowDist = length(nx, ny + 0.15)
        const glow = Math.max(0, 1.0 - glowDist / 0.5) * 0.15
        col = blend(col, [234, 88, 12, 255], glow)

        // Subtle outer border highlight (terracotta / orange glow on edge)
        const borderD = Math.abs(boxD + 0.015) - 0.012
        const borderMask = (1.0 - smoothstep(-aa, aa, borderD)) * 0.75
        if (borderMask > 0) {
          col = blend(col, [234, 88, 12, 255], borderMask)
        }
      }

      // 2. Code Brackets: < and >
      const bracketThickness = 0.038

      // Left Bracket <
      const lb1 = sdSegment(nx, ny, -0.16, -0.20, -0.32, 0.0)
      const lb2 = sdSegment(nx, ny, -0.32, 0.0, -0.16, 0.20)
      const lbD = Math.min(lb1, lb2) - bracketThickness
      const lbMask = 1.0 - smoothstep(-aa, aa, lbD)
      if (lbMask > 0) {
        col = blend(col, [248, 250, 252, 255], lbMask) // Pure white
      }

      // Right Bracket >
      const rb1 = sdSegment(nx, ny, 0.16, -0.20, 0.32, 0.0)
      const rb2 = sdSegment(nx, ny, 0.32, 0.0, 0.16, 0.20)
      const rbD = Math.min(rb1, rb2) - bracketThickness
      const rbMask = 1.0 - smoothstep(-aa, aa, rbD)
      if (rbMask > 0) {
        col = blend(col, [248, 250, 252, 255], rbMask) // Pure white
      }

      // 3. Central Competitive Programming Podium Bars (Codeforces 3 Pillars)
      // Left Bar: Blue #3B82F6 (Medium height)
      const blueBarD = sdSegment(nx, ny, -0.07, -0.05, -0.07, 0.20) - 0.024
      const blueMask = 1.0 - smoothstep(-aa, aa, blueBarD)
      if (blueMask > 0) {
        col = blend(col, [59, 130, 246, 255], blueMask)
      }

      // Middle Bar: Terracotta Red/Orange #EA580C (Tallest)
      const orangeBarD = sdSegment(nx, ny, 0.0, -0.18, 0.0, 0.20) - 0.024
      const orangeMask = 1.0 - smoothstep(-aa, aa, orangeBarD)
      if (orangeMask > 0) {
        col = blend(col, [234, 88, 12, 255], orangeMask)
      }

      // Right Bar: Amber/Gold #F59E0B (Shortest)
      const goldBarD = sdSegment(nx, ny, 0.07, 0.04, 0.07, 0.20) - 0.024
      const goldMask = 1.0 - smoothstep(-aa, aa, goldBarD)
      if (goldMask > 0) {
        col = blend(col, [245, 158, 11, 255], goldMask)
      }

      pixels[idx]     = col[0]
      pixels[idx + 1] = col[1]
      pixels[idx + 2] = col[2]
      pixels[idx + 3] = col[3]
    }
  }

  return pixels
}

// ─── Generate Assets ──────────────────────────────────────────────────────────

console.log('Generating high-resolution icons...')

// 1. Main 512x512 PNG
const png512Pixels = renderIcon(512, false)
const png512 = makePngBuffer(png512Pixels, 512, 512)
writeFileSync(join(BUILD, 'icon.png'), png512)
console.log('  ✓ build/icon.png (512x512 RGBA)')

// 2. Tray Icon 32x32 PNG
const trayPixels = renderIcon(32, true)
const trayPng = makePngBuffer(trayPixels, 32, 32)
writeFileSync(join(BUILD, 'tray-icon.png'), trayPng)
console.log('  ✓ build/tray-icon.png (32x32 RGBA)')

// 3. Multi-resolution Windows ICO (16, 32, 48, 64, 128, 256)
const icoSizes = [16, 32, 48, 64, 128, 256]
const icoPngs = icoSizes.map(s => {
  const p = renderIcon(s, false)
  return makePngBuffer(p, s, s)
})
const icoBuffer = makeIcoBuffer(icoPngs, icoSizes)
writeFileSync(join(BUILD, 'icon.ico'), icoBuffer)
console.log('  ✓ build/icon.ico (16, 32, 48, 64, 128, 256 px)')

console.log('All desktop and system icons generated successfully!')
