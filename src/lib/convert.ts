// スタンプの配置を別の規格（絵文字など）へ写す（Canvas 非依存の純粋関数）
import type { Bounds } from './pixels'
import type { ModeSpec } from './specs'
import type { StickerItem } from './types'

export interface ConvertInput {
  /** 元画像の大きさ（画像なしなら null） */
  imageSize: { width: number; height: number } | null
  /** 元の規格で描画したときの、内容（透明でない部分）の範囲 */
  content: Bounds | null
  /** 元の規格での文字の実際の中心とフォントサイズ（はみ出し補正・自動縮小後） */
  text: { cx: number; cy: number; fontSize: number } | null
}

const fit = (spec: ModeSpec, size: { width: number; height: number }) =>
  Math.min((spec.width - spec.margin * 2) / size.width, (spec.height - spec.margin * 2) / size.height)

/**
 * 元の規格での見た目を保ったまま、内容が変換先のセーフエリアいっぱいに収まるよう写す。
 * keepText が false の場合は文字を消す（content は文字なしで測ったものを渡す）。
 */
export function convertItem(
  item: StickerItem,
  from: ModeSpec,
  to: ModeSpec,
  input: ConvertInput,
  keepText: boolean,
  newId: string,
): StickerItem {
  const b = input.content ?? { x: from.margin, y: from.margin, width: from.width - from.margin * 2, height: from.height - from.margin * 2 }
  const k = Math.min((to.width - to.margin * 2) / b.width, (to.height - to.margin * 2) / b.height)
  const map = (x: number, y: number) => ({
    x: (x - (b.x + b.width / 2)) * k + to.width / 2,
    y: (y - (b.y + b.height / 2)) * k + to.height / 2,
  })

  const tr = item.transform
  const center = map(from.width / 2 + tr.x, from.height / 2 + tr.y)
  const scale = input.imageSize ? (fit(from, input.imageSize) * tr.scale * k) / fit(to, input.imageSize) : tr.scale

  const t = item.text
  const textCenter = map(input.text?.cx ?? t.x * from.width, input.text?.cy ?? t.y * from.height)
  const scaled = (v: number) => (v > 0 ? Math.max(1, Math.round(v * k)) : 0)

  const { animation: _animation, ...rest } = item
  return {
    ...rest,
    id: newId,
    transform: { ...tr, scale, x: center.x - to.width / 2, y: center.y - to.height / 2 },
    text: {
      ...t,
      content: keepText ? t.content : '',
      size: Math.max(8, Math.round((input.text?.fontSize ?? t.size) * k)),
      strokeWidth: scaled(t.strokeWidth),
      x: textCenter.x / to.width,
      y: textCenter.y / to.height,
    },
    outline: { ...item.outline, width: item.outline.enabled ? scaled(item.outline.width) : item.outline.width },
  }
}
