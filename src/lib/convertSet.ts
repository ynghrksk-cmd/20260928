import { convertItem } from './convert'
import { ensureFonts } from './fonts'
import { alphaBounds } from './pixels'
import { newId } from './presets'
import { canvasPixels, createCanvas, layoutText, renderItem } from './render'
import type { ModeSpec } from './specs'
import type { SourceImage, StickerItem } from './types'

/**
 * スタンプのセットを別の規格（絵文字など）に変換する。
 * 元の規格で実際に描画して内容の範囲を測り、変換先いっぱいに収まるよう配置し直す。
 */
export async function convertSet(
  items: StickerItem[],
  sources: SourceImage[],
  from: ModeSpec,
  to: ModeSpec,
  keepText: boolean,
): Promise<StickerItem[]> {
  if (keepText) await ensureFonts(items.map((i) => i.text))
  const measure = createCanvas(1, 1).getContext('2d')!
  return items.map((item) => {
    const source = sources.find((s) => s.id === item.sourceId)
    // 文字を消す場合は、画像だけで範囲を測る
    const target = keepText ? item : { ...item, text: { ...item.text, content: '' } }
    const canvas = renderItem(target, source, from)
    const content = alphaBounds(canvasPixels(canvas), canvas.width, canvas.height)
    const layout = keepText ? layoutText(measure, item, from) : null
    return convertItem(
      item,
      from,
      to,
      {
        imageSize: source ? { width: source.canvas.width, height: source.canvas.height } : null,
        content,
        text: layout && {
          cx: layout.box.x + layout.box.width / 2,
          cy: layout.box.y + layout.box.height / 2,
          fontSize: layout.fontSize,
        },
      },
      keepText,
      newId(),
    )
  })
}
