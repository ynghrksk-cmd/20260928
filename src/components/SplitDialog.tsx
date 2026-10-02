import { useEffect, useMemo, useRef, useState } from 'react'
import { newId } from '../lib/presets'
import { createCanvas } from '../lib/render'
import { backgroundMask, detectCells, tightenRect, uniformGrid } from '../lib/split'
import type { SourceImage } from '../lib/types'

interface Props {
  source: SourceImage
  onCancel: () => void
  onSplit: (parts: SourceImage[]) => void
}

export function SplitDialog({ source, onCancel, onSplit }: Props) {
  const [mode, setMode] = useState<'auto' | 'grid'>('auto')
  const [rows, setRows] = useState(2)
  const [cols, setCols] = useState(2)
  const [trim, setTrim] = useState(true)
  const preview = useRef<HTMLCanvasElement>(null)
  const { canvas, background } = source

  const mask = useMemo(() => {
    const data = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height).data
    return backgroundMask(data, canvas.width, canvas.height, background.color, Math.max(background.tolerance, 12))
  }, [canvas, background.color, background.tolerance])

  const rects = useMemo(() => {
    const { width, height } = canvas
    const base = mode === 'auto' ? detectCells(mask, width, height) : uniformGrid(width, height, rows, cols)
    const pad = Math.round(Math.max(width, height) * 0.01)
    return trim ? base.map((r) => tightenRect(mask, width, height, r, pad)) : base
  }, [canvas, mask, mode, rows, cols, trim])

  useEffect(() => {
    const c = preview.current
    if (!c) return
    c.width = canvas.width
    c.height = canvas.height
    const ctx = c.getContext('2d')!
    ctx.drawImage(canvas, 0, 0)
    const line = Math.max(2, canvas.width / 300)
    ctx.lineWidth = line
    ctx.font = `bold ${Math.max(14, canvas.width / 30)}px sans-serif`
    rects.forEach((r, i) => {
      ctx.strokeStyle = '#06c755'
      ctx.strokeRect(r.x + line / 2, r.y + line / 2, r.width - line, r.height - line)
      ctx.fillStyle = '#06c755'
      ctx.fillText(String(i + 1), r.x + line * 3, r.y + line * 3 + Math.max(14, canvas.width / 30))
    })
  }, [canvas, rects])

  const split = () => {
    const base = source.name.replace(/\.[^.]+$/, '')
    onSplit(
      rects.map((r, i) => {
        const part = createCanvas(r.width, r.height)
        part.getContext('2d')!.drawImage(canvas, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height)
        return { id: newId(), name: `${base}-${i + 1}`, canvas: part, background: { ...background } }
      }),
    )
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" role="dialog" aria-label="画像を分割" onClick={(e) => e.stopPropagation()}>
        <h2>画像を分割</h2>
        <p className="hint">ポーズ一覧のような1枚の画像を、コマごとの画像に切り分けます。</p>
        <div className="row">
          <label className="check">
            <input type="radio" checked={mode === 'auto'} onChange={() => setMode('auto')} />
            自動検出（背景のすき間で区切る）
          </label>
          <label className="check">
            <input type="radio" checked={mode === 'grid'} onChange={() => setMode('grid')} />
            均等に分割
          </label>
        </div>
        {mode === 'grid' && (
          <div className="row">
            <label>
              行{' '}
              <input type="number" min={1} max={10} value={rows} onChange={(e) => setRows(clamp(e.target.value))} />
            </label>
            <label>
              列{' '}
              <input type="number" min={1} max={10} value={cols} onChange={(e) => setCols(clamp(e.target.value))} />
            </label>
          </div>
        )}
        <label className="check">
          <input type="checkbox" checked={trim} onChange={(e) => setTrim(e.target.checked)} />
          各コマの余白を詰める
        </label>
        <canvas ref={preview} className="checker split-preview" />
        <p className="hint">
          {rects.length} 枚に分割します。
          {mode === 'auto' && rects.length <= 1 && ' うまく検出できない場合は「均等に分割」を試してください。'}
        </p>
        <div className="row end">
          <button onClick={onCancel}>キャンセル</button>
          <button className="primary" disabled={rects.length < 2} onClick={split}>
            {rects.length} 枚に分割
          </button>
        </div>
      </div>
    </div>
  )
}

const clamp = (v: string) => Math.min(10, Math.max(1, Math.round(Number(v)) || 1))
