// Canvas に依存しない画素処理（テスト可能な純粋関数）

export type RGB = [number, number, number]

export function colorDistance(data: Uint8ClampedArray, i: number, c: RGB): number {
  const dr = data[i] - c[0]
  const dg = data[i + 1] - c[1]
  const db = data[i + 2] - c[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

/**
 * 指定色に近い画素を透明にする（data を直接書き換える）。
 * tolerance は 0〜100 で、100 で RGB 空間の最大距離に相当。
 * contiguous が true の場合、画像の外周から連続している領域だけを消す
 * （キャラクター内部の白目などを残せる）。
 */
export function removeBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  color: RGB,
  tolerance: number,
  contiguous: boolean,
): void {
  const maxDist = (tolerance / 100) * 441.67
  // 境界をなめらかにするため、しきい値付近は半透明にする
  const feather = Math.max(4, maxDist * 0.25)
  const matches = (p: number) => colorDistance(data, p * 4, color) <= maxDist + feather

  const apply = (p: number) => {
    const i = p * 4
    const d = colorDistance(data, i, color)
    if (d <= maxDist) data[i + 3] = 0
    else if (d <= maxDist + feather) {
      data[i + 3] = Math.min(data[i + 3], Math.round(((d - maxDist) / feather) * 255))
    }
  }

  const total = width * height
  if (!contiguous) {
    for (let p = 0; p < total; p++) apply(p)
    return
  }

  const visited = new Uint8Array(total)
  const stack: number[] = []
  const push = (p: number) => {
    if (!visited[p] && matches(p)) {
      visited[p] = 1
      stack.push(p)
    }
  }
  for (let x = 0; x < width; x++) {
    push(x)
    push((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    push(y * width)
    push(y * width + width - 1)
  }
  while (stack.length) {
    const p = stack.pop()!
    apply(p)
    const x = p % width
    const y = (p - x) / width
    if (x > 0) push(p - 1)
    if (x < width - 1) push(p + 1)
    if (y > 0) push(p - width)
    if (y < height - 1) push(p + width)
  }
}

/** 四隅の画素から最も多い色を推定（背景色の初期値に使う） */
export function guessBackground(data: Uint8ClampedArray, width: number, height: number): RGB {
  const corners = [0, width - 1, (height - 1) * width, height * width - 1].map((p) => {
    const i = p * 4
    return [data[i], data[i + 1], data[i + 2]] as RGB
  })
  let best = corners[0]
  let bestScore = -1
  for (const c of corners) {
    const score = corners.filter(
      (o) => Math.abs(o[0] - c[0]) + Math.abs(o[1] - c[1]) + Math.abs(o[2] - c[2]) < 30,
    ).length
    if (score > bestScore) {
      best = c
      bestScore = score
    }
  }
  return best
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/** 不透明画素の外接矩形。全て透明なら null */
export function alphaBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 8,
): Bounds | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > threshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

/**
 * トリミング後の切り出し範囲を求める。
 * 内容の外接矩形に margin を足し、LINE の規定どおり幅・高さを偶数にし、
 * キャンバス（最大サイズ）からはみ出さないように調整する。
 */
export function trimRect(
  content: Bounds,
  canvasWidth: number,
  canvasHeight: number,
  margin: number,
): Bounds {
  const fit = (start: number, size: number, max: number) => {
    let s = start - margin
    let len = size + margin * 2
    if (len % 2 === 1) len += 1
    len = Math.min(len, max - (max % 2))
    s = Math.max(0, Math.min(s, max - len))
    return [s, len] as const
  }
  const [x, w] = fit(content.x, content.width, canvasWidth)
  const [y, h] = fit(content.y, content.height, canvasHeight)
  return { x, y, width: w, height: h }
}
