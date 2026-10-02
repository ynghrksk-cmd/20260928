import JSZip from 'jszip'
import { canvasToBlob, fitInto, renderItem, trimCanvas } from './render'
import type { Mode } from './specs'
import { SPECS } from './specs'
import type { SourceImage, StickerItem } from './types'

export interface ExportResult {
  blob: Blob
  warnings: string[]
}

const MAX_BYTES = 1024 * 1024

export async function exportZip(
  mode: Mode,
  items: StickerItem[],
  sources: SourceImage[],
  mainIndex: number,
): Promise<ExportResult> {
  const spec = SPECS[mode]
  const zip = new JSZip()
  const warnings: string[] = []
  const find = (id: string | null) => sources.find((s) => s.id === id)

  const rendered = items.map((item) => renderItem(item, find(item.sourceId), spec))
  for (const [i, canvas] of rendered.entries()) {
    const out = spec.trim ? trimCanvas(canvas, spec.margin) : canvas
    const blob = await canvasToBlob(out)
    const name = spec.fileName(i + 1)
    if (blob.size > MAX_BYTES) warnings.push(`${name} が 1MB を超えています`)
    zip.file(name, blob)
  }

  const cover = rendered[mainIndex] ?? rendered[0]
  if (cover) {
    if (spec.main) zip.file('main.png', await canvasToBlob(fitInto(cover, spec.main.width, spec.main.height, 8)))
    zip.file('tab.png', await canvasToBlob(fitInto(cover, spec.tab.width, spec.tab.height, 4)))
  }

  if (!spec.counts.includes(items.length)) {
    warnings.push(`${spec.label}の枚数は ${spec.counts.join('/')} のいずれかにする必要があります（現在 ${items.length} 枚）`)
  }
  return { blob: await zip.generateAsync({ type: 'blob' }), warnings }
}
