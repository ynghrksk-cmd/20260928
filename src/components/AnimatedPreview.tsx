import { useEffect, useMemo, useRef } from 'react'
import { frameDelay, normalizeAnimation } from '../lib/animation'
import { renderFrames } from '../lib/render'
import type { ModeSpec } from '../lib/specs'
import type { SourceImage, StickerItem } from '../lib/types'

interface Props {
  item: StickerItem
  sources: SourceImage[]
  spec: ModeSpec
}

/** アニメーションを実際の速さ・ループ回数で再生する（終わったら少し待って繰り返す） */
export function AnimatedPreview({ item, sources, spec }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const frames = useMemo(() => renderFrames(item, sources, spec), [item, sources, spec])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !frames.length || !item.animation) return
    const anim = normalizeAnimation(item.animation)
    const delay = frameDelay(anim) * 10
    const total = frames.length * anim.loops
    const ctx = canvas.getContext('2d')!
    let step = 0
    let timer = 0
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(frames[step % frames.length], 0, 0)
      step++
      // 最後まで再生したら最終フレームのまま 1 秒止めて、また最初から
      if (step >= total) {
        step = 0
        timer = window.setTimeout(tick, delay + 1000)
      } else timer = window.setTimeout(tick, delay)
    }
    tick()
    return () => clearTimeout(timer)
  }, [frames, item.animation])

  return <canvas ref={ref} className="checker preview-canvas" width={spec.width} height={spec.height} />
}
