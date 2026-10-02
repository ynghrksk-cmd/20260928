// 1枚のイラスト一覧画像を複数のコマに分割する（Canvas 非依存の純粋関数）
import { colorDistance, type Bounds, type RGB } from './pixels'

/** 背景とみなす画素を 1 にしたマスク（透明、または背景色に近い画素） */
export function backgroundMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  color: RGB,
  tolerance: number,
): Uint8Array {
  const maxDist = (tolerance / 100) * 441.67
  const mask = new Uint8Array(width * height)
  for (let p = 0; p < width * height; p++) {
    const i = p * 4
    mask[p] = data[i + 3] < 16 || colorDistance(data, i, color) <= maxDist ? 1 : 0
  }
  return mask
}

/** 行数×列数で均等に区切る */
export function uniformGrid(width: number, height: number, rows: number, cols: number): Bounds[] {
  const rects: Bounds[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = Math.round((c * width) / cols)
      const y = Math.round((r * height) / rows)
      rects.push({
        x,
        y,
        width: Math.round(((c + 1) * width) / cols) - x,
        height: Math.round(((r + 1) * height) / rows) - y,
      })
    }
  }
  return rects
}

/** 線上（横または縦）の前景画素が少なければ「すき間」とみなし、前景の続く区間を返す */
function segments(isGap: (i: number) => boolean, length: number, minSize: number): [number, number][] {
  const out: [number, number][] = []
  let start = -1
  for (let i = 0; i <= length; i++) {
    const gap = i === length || isGap(i)
    if (!gap && start < 0) start = i
    if (gap && start >= 0) {
      if (i - start >= minSize) out.push([start, i])
      start = -1
    }
  }
  return out
}

/**
 * 背景のすき間でコマを自動検出する。
 * まず横方向のすき間で段に分け、各段を縦方向のすき間で区切る。
 * 小さすぎるゴミ（全体の 3% 未満）は無視する。
 */
export function detectCells(mask: Uint8Array, width: number, height: number): Bounds[] {
  const fg = (x: number, y: number) => mask[y * width + x] === 0
  const noise = (len: number) => Math.max(1, Math.floor(len * 0.003))
  const rowGap = (y: number, x0 = 0, x1 = width) => {
    let n = 0
    for (let x = x0; x < x1; x++) if (fg(x, y) && ++n > noise(x1 - x0)) return false
    return true
  }
  const colGap = (x: number, y0: number, y1: number) => {
    let n = 0
    for (let y = y0; y < y1; y++) if (fg(x, y) && ++n > noise(y1 - y0)) return false
    return true
  }

  const rects: Bounds[] = []
  for (const [y0, y1] of segments((y) => rowGap(y), height, Math.ceil(height * 0.03))) {
    for (const [x0, x1] of segments((x) => colGap(x, y0, y1), width, Math.ceil(width * 0.03))) {
      // 段の高さは段全体なので、コマごとに上下も詰める
      const inner = segments((y) => rowGap(y + y0, x0, x1), y1 - y0, 1)
      if (!inner.length) continue
      const top = y0 + inner[0][0]
      const bottom = y0 + inner[inner.length - 1][1]
      rects.push({ x: x0, y: top, width: x1 - x0, height: bottom - top })
    }
  }
  return rects
}

/** コマ内の前景に合わせて矩形を詰め、pad だけ余白を残す */
export function tightenRect(mask: Uint8Array, width: number, height: number, rect: Bounds, pad: number): Bounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -1
  let maxY = -1
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      if (mask[y * width + x] === 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return rect
  const x = Math.max(0, minX - pad)
  const y = Math.max(0, minY - pad)
  return {
    x,
    y,
    width: Math.min(width, maxX + 1 + pad) - x,
    height: Math.min(height, maxY + 1 + pad) - y,
  }
}
