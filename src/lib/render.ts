import { fontString } from './fonts'
import { alphaBounds, removeBackground, trimRect, type Bounds } from './pixels'
import type { ModeSpec } from './specs'
import type { SourceImage, StickerItem } from './types'

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c
}

const ctx2d = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!

/** 読み込んだ画像を処理しやすい大きさに縮小してキャンバス化 */
export function imageToCanvas(img: CanvasImageSource & { width: number; height: number }, maxSize = 1024) {
  const s = Math.min(1, maxSize / Math.max(img.width, img.height))
  const c = createCanvas(Math.max(1, Math.round(img.width * s)), Math.max(1, Math.round(img.height * s)))
  ctx2d(c).drawImage(img, 0, 0, c.width, c.height)
  return c
}

// 背景透過済み画像のキャッシュ（設定が変わったときだけ再計算する）
const processedCache = new Map<string, { key: string; canvas: HTMLCanvasElement }>()

export function processedSource(src: SourceImage): HTMLCanvasElement {
  const bg = src.background
  if (!bg.enabled) return src.canvas
  const key = JSON.stringify(bg)
  const hit = processedCache.get(src.id)
  if (hit && hit.key === key) return hit.canvas
  const { width, height } = src.canvas
  const out = createCanvas(width, height)
  const ctx = ctx2d(out)
  ctx.drawImage(src.canvas, 0, 0)
  const data = ctx.getImageData(0, 0, width, height)
  removeBackground(data.data, width, height, bg.color, bg.tolerance, bg.contiguous)
  ctx.putImageData(data, 0, 0)
  processedCache.set(src.id, { key, canvas: out })
  return out
}

function silhouette(layer: HTMLCanvasElement, color: string) {
  const c = createCanvas(layer.width, layer.height)
  const ctx = ctx2d(c)
  ctx.drawImage(layer, 0, 0)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, c.width, c.height)
  return c
}

/** 画像レイヤーの周囲にフチを付ける */
function addOutline(layer: HTMLCanvasElement, width: number, color: string) {
  const out = createCanvas(layer.width, layer.height)
  const ctx = ctx2d(out)
  const sil = silhouette(layer, color)
  const steps = Math.max(16, Math.ceil(width * 4))
  for (const r of [width, width * 0.5]) {
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2
      ctx.drawImage(sil, Math.cos(a) * r, Math.sin(a) * r)
    }
  }
  ctx.drawImage(layer, 0, 0)
  return out
}

interface TextLayout {
  lines: string[]
  fontSize: number
  lineHeight: number
  box: Bounds
}

/** セリフの配置を計算（セーフエリアからはみ出す場合は文字を縮小） */
export function layoutText(ctx: CanvasRenderingContext2D, item: StickerItem, spec: ModeSpec): TextLayout | null {
  const t = item.text
  if (!t.content.trim()) return null
  const lines = t.content.split('\n')
  const maxWidth = spec.width - spec.margin * 2 - t.strokeWidth * 2
  ctx.font = fontString(t.font, t.size)
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width))
  const fontSize = widest > maxWidth ? Math.floor((t.size * maxWidth) / widest) : t.size
  const lineHeight = fontSize * 1.15
  const w = Math.min(widest, maxWidth) + t.strokeWidth * 2
  const h = lineHeight * lines.length + t.strokeWidth * 2
  // 文字がキャンバスからはみ出さないよう中心位置を補正
  const clamp = (v: number, size: number, max: number) =>
    size >= max - spec.margin * 2 ? max / 2 : Math.min(Math.max(v, spec.margin + size / 2), max - spec.margin - size / 2)
  const cx = clamp(t.x * spec.width, w, spec.width)
  const cy = clamp(t.y * spec.height, h, spec.height)
  return { lines, fontSize, lineHeight, box: { x: cx - w / 2, y: cy - h / 2, width: w, height: h } }
}

function drawText(ctx: CanvasRenderingContext2D, item: StickerItem, spec: ModeSpec) {
  const layout = layoutText(ctx, item, spec)
  if (!layout) return
  const t = item.text
  ctx.save()
  ctx.translate(layout.box.x + layout.box.width / 2, layout.box.y + layout.box.height / 2)
  ctx.rotate((t.rotation * Math.PI) / 180)
  ctx.font = fontString(t.font, layout.fontSize)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  const top = -((layout.lines.length - 1) * layout.lineHeight) / 2
  layout.lines.forEach((line, i) => {
    const y = top + i * layout.lineHeight
    if (t.strokeWidth > 0) {
      ctx.strokeStyle = t.strokeColor
      ctx.lineWidth = t.strokeWidth * 2
      ctx.strokeText(line, 0, y)
    }
    ctx.fillStyle = t.color
    ctx.fillText(line, 0, y)
  })
  ctx.restore()
}

/** 画像の描画倍率（セーフエリアに収まる倍率 × ユーザー指定の倍率） */
export function imageScale(source: HTMLCanvasElement, item: StickerItem, spec: ModeSpec) {
  const sw = spec.width - spec.margin * 2
  const sh = spec.height - spec.margin * 2
  return Math.min(sw / source.width, sh / source.height) * item.transform.scale
}

/** 1枚分をキャンバスサイズ（370×320 など）で描画する */
export function renderItem(item: StickerItem, source: SourceImage | undefined, spec: ModeSpec) {
  const out = createCanvas(spec.width, spec.height)
  const ctx = ctx2d(out)
  if (source) {
    const img = processedSource(source)
    let layer = createCanvas(spec.width, spec.height)
    const lctx = ctx2d(layer)
    const tr = item.transform
    const s = imageScale(img, item, spec)
    lctx.translate(spec.width / 2 + tr.x, spec.height / 2 + tr.y)
    lctx.rotate((tr.rotation * Math.PI) / 180)
    lctx.scale(tr.flipX ? -s : s, s)
    lctx.imageSmoothingQuality = 'high'
    lctx.drawImage(img, -img.width / 2, -img.height / 2)
    if (item.outline.enabled && item.outline.width > 0) {
      layer = addOutline(layer, item.outline.width, item.outline.color)
    }
    ctx.drawImage(layer, 0, 0)
  }
  drawText(ctx, item, spec)
  return out
}

/** 透明な余白を詰める（LINE の規定どおり余白付き・偶数サイズ） */
export function trimCanvas(canvas: HTMLCanvasElement, margin: number) {
  const ctx = ctx2d(canvas)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const content = alphaBounds(data.data, canvas.width, canvas.height)
  if (!content) return canvas
  const r = trimRect(content, canvas.width, canvas.height, margin)
  const out = createCanvas(r.width, r.height)
  ctx2d(out).drawImage(canvas, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height)
  return out
}

/** 内容を指定サイズの中央に収める（メイン画像・タブ画像用） */
export function fitInto(canvas: HTMLCanvasElement, width: number, height: number, margin: number) {
  const trimmed = trimCanvas(canvas, 0)
  const out = createCanvas(width, height)
  const s = Math.min((width - margin * 2) / trimmed.width, (height - margin * 2) / trimmed.height)
  const w = trimmed.width * s
  const h = trimmed.height * s
  const ctx = ctx2d(out)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(trimmed, (width - w) / 2, (height - h) / 2, w, h)
  return out
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG の生成に失敗しました'))), 'image/png'),
  )
}
