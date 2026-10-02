import { describe, expect, it } from 'vitest'
import { alphaBounds, guessBackground, removeBackground, trimRect } from './pixels'

function makeImage(w: number, h: number, fill: [number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let p = 0; p < w * h; p++) data.set([...fill, 255], p * 4)
  return data
}
function setPixel(data: Uint8ClampedArray, w: number, x: number, y: number, c: number[]) {
  data.set([...c, 255], (y * w + x) * 4)
}
const alpha = (data: Uint8ClampedArray, w: number, x: number, y: number) => data[(y * w + x) * 4 + 3]

describe('removeBackground', () => {
  // 白背景に黒い枠、その内側に白（白目のような部分）
  const build = () => {
    const w = 7
    const data = makeImage(w, 7, [255, 255, 255])
    for (let i = 1; i <= 5; i++) {
      setPixel(data, w, i, 1, [0, 0, 0])
      setPixel(data, w, i, 5, [0, 0, 0])
      setPixel(data, w, 1, i, [0, 0, 0])
      setPixel(data, w, 5, i, [0, 0, 0])
    }
    return { data, w }
  }

  it('contiguous: 外周につながる背景だけを消す', () => {
    const { data, w } = build()
    removeBackground(data, w, 7, [255, 255, 255], 10, true)
    expect(alpha(data, w, 0, 0)).toBe(0)
    expect(alpha(data, w, 1, 1)).toBe(255)
    expect(alpha(data, w, 3, 3)).toBe(255)
  })

  it('global: 同じ色をすべて消す', () => {
    const { data, w } = build()
    removeBackground(data, w, 7, [255, 255, 255], 10, false)
    expect(alpha(data, w, 0, 0)).toBe(0)
    expect(alpha(data, w, 3, 3)).toBe(0)
    expect(alpha(data, w, 1, 1)).toBe(255)
  })
})

describe('guessBackground', () => {
  it('四隅の多数派の色を返す', () => {
    const w = 4
    const data = makeImage(w, 4, [0, 200, 0])
    setPixel(data, w, 0, 0, [255, 0, 0])
    expect(guessBackground(data, w, 4)).toEqual([0, 200, 0])
  })
})

describe('alphaBounds', () => {
  it('不透明部分の外接矩形を返す', () => {
    const w = 10
    const data = new Uint8ClampedArray(w * 10 * 4)
    setPixel(data, w, 2, 3, [0, 0, 0])
    setPixel(data, w, 6, 8, [0, 0, 0])
    expect(alphaBounds(data, w, 10)).toEqual({ x: 2, y: 3, width: 5, height: 6 })
  })
  it('全て透明なら null', () => {
    expect(alphaBounds(new Uint8ClampedArray(16), 2, 2)).toBeNull()
  })
})

describe('trimRect', () => {
  it('余白を付けて偶数サイズにする', () => {
    const r = trimRect({ x: 100, y: 50, width: 101, height: 77 }, 370, 320, 10)
    expect(r).toEqual({ x: 90, y: 40, width: 122, height: 98 })
    expect(r.width % 2).toBe(0)
    expect(r.height % 2).toBe(0)
  })
  it('キャンバスからはみ出さない', () => {
    const r = trimRect({ x: 0, y: 0, width: 370, height: 320 }, 370, 320, 10)
    expect(r).toEqual({ x: 0, y: 0, width: 370, height: 320 })
  })
  it('端に寄っていても範囲内に収める', () => {
    const r = trimRect({ x: 360, y: 5, width: 9, height: 9 }, 370, 320, 10)
    expect(r.x + r.width).toBeLessThanOrEqual(370)
    expect(r.y).toBeGreaterThanOrEqual(0)
  })
})
