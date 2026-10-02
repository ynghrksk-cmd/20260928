import { describe, expect, it } from 'vitest'
import { backgroundMask, detectCells, tightenRect, uniformGrid } from './split'

/** 白背景に黒い四角を並べた画像 */
function sheet(w: number, h: number, boxes: [number, number, number, number][]) {
  const data = new Uint8ClampedArray(w * h * 4).fill(255)
  for (const [bx, by, bw, bh] of boxes) {
    for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) data.set([0, 0, 0, 255], (y * w + x) * 4)
  }
  return backgroundMask(data, w, h, [255, 255, 255], 10)
}

describe('uniformGrid', () => {
  it('画像全体を隙間なく行×列に分ける', () => {
    const rects = uniformGrid(101, 50, 2, 3)
    expect(rects).toHaveLength(6)
    expect(rects[2].x + rects[2].width).toBe(101)
    expect(rects[5].y + rects[5].height).toBe(50)
    expect(rects.reduce((s, r) => s + r.width * r.height, 0)).toBe(101 * 50)
  })
})

describe('detectCells', () => {
  it('背景のすき間で 2×3 のコマを見つける', () => {
    const boxes: [number, number, number, number][] = []
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) boxes.push([10 + c * 40, 10 + r * 50, 30, 20 + c * 5])
    const cells = detectCells(sheet(130, 110, boxes), 130, 110)
    expect(cells).toHaveLength(6)
    expect(cells[0]).toEqual({ x: 10, y: 10, width: 30, height: 20 })
    // 段の中で高さが違っても、コマごとに上下を詰める
    expect(cells[2]).toEqual({ x: 90, y: 10, width: 30, height: 30 })
    expect(cells[3].y).toBe(60)
  })

  it('小さなゴミは無視する', () => {
    const cells = detectCells(sheet(100, 100, [[10, 10, 40, 40], [80, 90, 1, 1]]), 100, 100)
    expect(cells).toHaveLength(1)
  })
})

describe('tightenRect', () => {
  it('前景に合わせて余白付きで詰める', () => {
    const mask = sheet(50, 50, [[20, 20, 5, 5]])
    expect(tightenRect(mask, 50, 50, { x: 0, y: 0, width: 50, height: 50 }, 2)).toEqual({ x: 18, y: 18, width: 9, height: 9 })
  })
  it('前景がなければそのまま', () => {
    const mask = sheet(10, 10, [])
    const r = { x: 0, y: 0, width: 10, height: 10 }
    expect(tightenRect(mask, 10, 10, r, 2)).toBe(r)
  })
})
