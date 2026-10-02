import { unzlibSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { crc32, diffRect, encodeApng, posterize } from './apng'

/** PNG をチャンクに分解 */
function chunks(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset)
  const list: { type: string; data: Uint8Array; crcOk: boolean }[] = []
  let off = 8
  while (off < png.length) {
    const len = view.getUint32(off)
    const type = String.fromCharCode(...png.subarray(off + 4, off + 8))
    const data = png.subarray(off + 8, off + 8 + len)
    const crc = view.getUint32(off + 8 + len)
    list.push({ type, data, crcOk: ((crc32(png.subarray(off + 4, off + 8 + len)) ^ 0xffffffff) >>> 0) === crc })
    off += 12 + len
  }
  return list
}

/** 1行分のフィルタを戻して RGBA を復元 */
function unfilter(raw: Uint8Array, w: number, h: number) {
  const stride = w * 4
  const out = new Uint8Array(stride * h)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i]
      const a = i >= 4 ? out[y * stride + i - 4] : 0
      const b = y > 0 ? out[(y - 1) * stride + i] : 0
      const c = y > 0 && i >= 4 ? out[(y - 1) * stride + i - 4] : 0
      let pred = 0
      if (f === 1) pred = a
      else if (f === 2) pred = b
      else if (f === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      out[y * stride + i] = (x + pred) & 0xff
    }
  }
  return out
}

describe('encodeApng', () => {
  const w = 5
  const h = 4
  const frame = (seed: number) => Uint8Array.from({ length: w * h * 4 }, (_, i) => (i * 37 + seed * 11) & 0xff)
  const frames = [frame(1), frame(2), frame(3)]
  const png = encodeApng({ width: w, height: h, frames, delay: 25, loops: 2 })
  const list = chunks(png)

  it('PNG シグネチャと正しいチャンク順', () => {
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(list.map((c) => c.type)).toEqual(['IHDR', 'acTL', 'fcTL', 'IDAT', 'fcTL', 'fdAT', 'fcTL', 'fdAT', 'IEND'])
    expect(list.every((c) => c.crcOk)).toBe(true)
  })

  it('acTL にフレーム数とループ数、fcTL に通し番号と表示時間', () => {
    const actl = new DataView(list[1].data.buffer, list[1].data.byteOffset)
    expect([actl.getUint32(0), actl.getUint32(4)]).toEqual([3, 2])
    const fctls = list.filter((c) => c.type === 'fcTL').map((c) => new DataView(c.data.buffer, c.data.byteOffset))
    const fdats = list.filter((c) => c.type === 'fdAT').map((c) => new DataView(c.data.buffer, c.data.byteOffset))
    expect(fctls.map((v) => v.getUint32(0))).toEqual([0, 1, 3])
    expect(fdats.map((v) => v.getUint32(0))).toEqual([2, 4])
    expect(fctls.every((v) => v.getUint16(20) === 25 && v.getUint16(22) === 100)).toBe(true)
  })

  it('各フレームの画素を復元できる', () => {
    const idat = list.find((c) => c.type === 'IDAT')!.data
    expect(unfilter(unzlibSync(idat), w, h)).toEqual(frames[0])
    const fdat = list.filter((c) => c.type === 'fdAT')[1].data.subarray(4)
    expect(unfilter(unzlibSync(fdat), w, h)).toEqual(frames[2])
  })
})

describe('差分フレーム', () => {
  it('変化した範囲だけを記録し、合成すると元のフレームに戻る', () => {
    const w = 8
    const h = 6
    const base = new Uint8Array(w * h * 4)
    base.fill(200)
    const next = base.slice()
    // (2,1)〜(4,3) を透明に、(5,4) を赤に
    for (let y = 1; y <= 3; y++) for (let x = 2; x <= 4; x++) next.set([0, 0, 0, 0], (y * w + x) * 4)
    next.set([255, 0, 0, 255], (4 * w + 5) * 4)
    expect(diffRect(base, next, w, h)).toEqual({ x: 2, y: 1, width: 4, height: 4 })

    const png = encodeApng({ width: w, height: h, frames: [base, next, next], delay: 10, loops: 1 })
    const list = chunks(png)
    const canvas = unfilter(unzlibSync(list.find((c) => c.type === 'IDAT')!.data), w, h)
    const fctls = list.filter((c) => c.type === 'fcTL')
    const fdats = list.filter((c) => c.type === 'fdAT')
    fdats.forEach((fd, i) => {
      const v = new DataView(fctls[i + 1].data.buffer, fctls[i + 1].data.byteOffset)
      const [fw, fh, fx, fy] = [v.getUint32(4), v.getUint32(8), v.getUint32(12), v.getUint32(16)]
      const px = unfilter(unzlibSync(fd.data.subarray(4)), fw, fh)
      // blend_op = SOURCE で上書き
      for (let y = 0; y < fh; y++) canvas.set(px.subarray(y * fw * 4, (y + 1) * fw * 4), ((fy + y) * w + fx) * 4)
      expect(canvas).toEqual(next)
    })
    // 変化のないフレームは 1×1 で済む
    const last = new DataView(fctls[2].data.buffer, fctls[2].data.byteOffset)
    expect([last.getUint32(4), last.getUint32(8)]).toEqual([1, 1])
  })
})

describe('posterize', () => {
  it('色を段階化し、完全透明は 0 にする', () => {
    const out = posterize(new Uint8ClampedArray([13, 130, 250, 255, 99, 99, 99, 0]), 16)
    expect([...out]).toEqual([16, 128, 255, 255, 0, 0, 0, 0])
  })
})
