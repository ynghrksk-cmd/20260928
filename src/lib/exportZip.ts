import JSZip from 'jszip'
import { frameDelay, normalizeAnimation } from './animation'
import { encodeApng, posterize } from './apng'
import { canvasPixels, canvasToBlob, fitInto, fitWhole, renderFrames, renderItem, trimCanvas } from './render'
import type { Mode } from './specs'
import { SPECS } from './specs'
import type { SourceImage, StickerItem } from './types'

export interface ExportResult {
  blob: Blob
  warnings: string[]
}

const kb = (n: number) => `${Math.round(n / 1024)}KB`

/**
 * フレームを APNG にする。容量上限を超える場合は色数を段階的に減らして再圧縮する。
 */
function toApng(frames: HTMLCanvasElement[], delay: number, loops: number, maxBytes: number) {
  const { width, height } = frames[0]
  const pixels = frames.map(canvasPixels)
  let png = encodeApng({ width, height, frames: pixels, delay, loops })
  for (const step of [4, 8, 16, 32]) {
    if (png.length <= maxBytes) break
    png = encodeApng({ width, height, frames: pixels.map((p) => posterize(p, step)), delay, loops })
  }
  return png
}

export async function exportZip(
  mode: Mode,
  items: StickerItem[],
  sources: SourceImage[],
  mainIndex: number,
  onProgress?: (done: number, total: number) => void,
): Promise<ExportResult> {
  const spec = SPECS[mode]
  const zip = new JSZip()
  const warnings: string[] = []
  const find = (id: string | null) => sources.find((s) => s.id === id)
  // 静止画（およびアニメの最終フレーム＝基本の姿勢）
  const stills = items.map((item) => renderItem(item, find(item.sourceId), spec))

  for (const [i, item] of items.entries()) {
    onProgress?.(i, items.length)
    // 画面が固まらないよう、1枚ごとに描画の機会を与える
    await new Promise((r) => setTimeout(r, 0))
    const name = spec.fileName(i + 1)
    let data: Blob | Uint8Array
    if (spec.animated && item.animation) {
      const anim = normalizeAnimation(item.animation)
      data = toApng(renderFrames(item, sources, spec), frameDelay(anim), anim.loops, spec.maxBytes)
    } else {
      data = await canvasToBlob(spec.trim ? trimCanvas(stills[i], spec.margin) : stills[i])
    }
    const size = data instanceof Blob ? data.size : data.length
    if (size > spec.maxBytes) warnings.push(`${name} が ${kb(spec.maxBytes)} を超えています（${kb(size)}）`)
    zip.file(name, data)
  }

  const coverIndex = stills[mainIndex] ? mainIndex : 0
  const cover = stills[coverIndex]
  if (cover) {
    if (spec.main) {
      const mainItem = items[coverIndex]
      if (spec.animated && mainItem.animation) {
        const anim = normalizeAnimation(mainItem.animation)
        const frames = renderFrames(mainItem, sources, spec).map((f) => fitWhole(f, spec.main!.width, spec.main!.height))
        zip.file('main.png', toApng(frames, frameDelay(anim), anim.loops, spec.maxBytes))
      } else {
        zip.file('main.png', await canvasToBlob(fitInto(cover, spec.main.width, spec.main.height, 8)))
      }
    }
    zip.file('tab.png', await canvasToBlob(fitInto(cover, spec.tab.width, spec.tab.height, 4)))
  }

  if (!spec.counts.includes(items.length)) {
    warnings.push(`${spec.label}の枚数は ${spec.counts.join('/')} のいずれかにする必要があります（現在 ${items.length} 枚）`)
  }
  return { blob: await zip.generateAsync({ type: 'blob' }), warnings }
}
