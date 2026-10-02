// 依存の少ない APNG エンコーダ（RGBA・全フレーム同サイズ）
import { zlibSync } from 'fflate'

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(bytes: Uint8Array, crc = 0xffffffff): number {
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return crc
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, (crc32(out.subarray(4, 8 + data.length)) ^ 0xffffffff) >>> 0)
  return out
}

function u32s(...values: number[]) {
  const b = new Uint8Array(values.length * 4)
  const v = new DataView(b.buffer)
  values.forEach((x, i) => v.setUint32(i * 4, x))
  return b
}

/** 行ごとに None/Sub/Up/Paeth から最も圧縮しやすそうなフィルタを選び、zlib 圧縮する */
export function compressImage(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Uint8Array {
  const stride = width * 4
  const out = new Uint8Array((stride + 1) * height)
  const cand = [0, 1, 2, 4].map(() => new Uint8Array(stride))
  for (let y = 0; y < height; y++) {
    const row = y * stride
    const prev = y > 0 ? row - stride : -1
    let best = 0
    let bestScore = Infinity
    cand.forEach((buf, ci) => {
      let score = 0
      for (let i = 0; i < stride; i++) {
        const x = rgba[row + i]
        const a = i >= 4 ? rgba[row + i - 4] : 0
        const b = prev >= 0 ? rgba[prev + i] : 0
        const c = prev >= 0 && i >= 4 ? rgba[prev + i - 4] : 0
        let v: number
        if (ci === 0) v = x
        else if (ci === 1) v = x - a
        else if (ci === 2) v = x - b
        else {
          const p = a + b - c
          const pa = Math.abs(p - a)
          const pb = Math.abs(p - b)
          const pc = Math.abs(p - c)
          v = x - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
        }
        buf[i] = v & 0xff
        score += buf[i] < 128 ? buf[i] : 256 - buf[i]
      }
      if (score < bestScore) {
        bestScore = score
        best = ci
      }
    })
    out[y * (stride + 1)] = [0, 1, 2, 4][best]
    out.set(cand[best], y * (stride + 1) + 1)
  }
  return zlibSync(out, { level: 9 })
}

export interface ApngOptions {
  width: number
  height: number
  /** 各フレームの RGBA 画素 */
  frames: (Uint8Array | Uint8ClampedArray)[]
  /** 1フレームの表示時間（1/100 秒単位） */
  delay: number
  /** ループ回数（0 は無限） */
  loops: number
}

type Pixels = Uint8Array | Uint8ClampedArray

/** 前のフレームと画素が異なる範囲（同一なら 1×1） */
export function diffRect(prev: Pixels, cur: Pixels, width: number, height: number) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  const a = new Uint32Array(prev.buffer, prev.byteOffset, width * height)
  const b = new Uint32Array(cur.buffer, cur.byteOffset, width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (a[y * width + x] !== b[y * width + x]) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, width: 1, height: 1 }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

function crop(px: Pixels, width: number, r: { x: number; y: number; width: number; height: number }) {
  const out = new Uint8Array(r.width * r.height * 4)
  for (let y = 0; y < r.height; y++) {
    const start = ((r.y + y) * width + r.x) * 4
    out.set(px.subarray(start, start + r.width * 4), y * r.width * 4)
  }
  return out
}

/**
 * 2フレーム目以降は前フレームから変わった範囲だけを記録する。
 * dispose_op = NONE（前フレームを残す）＋ blend_op = SOURCE（範囲内を透明も含めて置き換え）
 * なので、合成結果は元のフレームと完全に一致する。
 */
export function encodeApng({ width, height, frames, delay, loops }: ApngOptions): Uint8Array {
  const parts: Uint8Array[] = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])]
  const ihdr = new Uint8Array(13)
  ihdr.set(u32s(width, height))
  ihdr.set([8, 6, 0, 0, 0], 8) // 8bit RGBA
  parts.push(chunk('IHDR', ihdr))
  parts.push(chunk('acTL', u32s(frames.length, loops)))

  let seq = 0
  frames.forEach((rgba, i) => {
    const r = i === 0 ? { x: 0, y: 0, width, height } : diffRect(frames[i - 1], rgba, width, height)
    const fctl = new Uint8Array(26)
    fctl.set(u32s(seq++, r.width, r.height, r.x, r.y))
    new DataView(fctl.buffer).setUint16(20, delay)
    new DataView(fctl.buffer).setUint16(22, 100)
    fctl[24] = 0 // dispose_op: NONE
    fctl[25] = 0 // blend_op: SOURCE（透明部分も含めて置き換える）
    parts.push(chunk('fcTL', fctl))
    const data = i === 0 ? compressImage(rgba, width, height) : compressImage(crop(rgba, width, r), r.width, r.height)
    if (i === 0) parts.push(chunk('IDAT', data))
    else {
      const fdat = new Uint8Array(4 + data.length)
      fdat.set(u32s(seq++))
      fdat.set(data, 4)
      parts.push(chunk('fdAT', fdat))
    }
  })
  parts.push(chunk('IEND', new Uint8Array()))

  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

/** 色数を減らして圧縮しやすくする（容量オーバー時の非可逆圧縮） */
export function posterize(rgba: Uint8ClampedArray, step: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length)
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue // 完全透明は 0 のままにして圧縮率を上げる
    for (let k = 0; k < 3; k++) out[i + k] = Math.round(rgba[i + k] / step) * step
    out[i + 3] = rgba[i + 3] > 250 ? 255 : Math.round(rgba[i + 3] / step) * step
  }
  return out
}
