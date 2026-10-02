import { useEffect, useRef, useState } from 'react'
import { ensureFonts } from '../lib/fonts'
import { renderItem } from '../lib/render'
import type { ModeSpec } from '../lib/specs'
import type { SourceImage, StickerItem } from '../lib/types'

interface Props {
  item: StickerItem
  source: SourceImage | undefined
  spec: ModeSpec
  className?: string
}

/** 1枚分のスタンプをプレビュー表示する */
export function ItemCanvas({ item, source, spec, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [fontTick, setFontTick] = useState(0)
  const { font, size, content } = item.text

  useEffect(() => {
    let cancelled = false
    ensureFonts([{ font, size, content }]).then(() => !cancelled && setFontTick((t) => t + 1))
    return () => {
      cancelled = true
    }
  }, [font, size, content])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const rendered = renderItem(item, source, spec)
    canvas.width = spec.width
    canvas.height = spec.height
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(rendered, 0, 0)
  }, [item, source, spec, fontTick])

  return <canvas ref={ref} className={`checker ${className ?? ''}`} width={spec.width} height={spec.height} />
}
