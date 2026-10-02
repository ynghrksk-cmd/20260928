import { useRef, type PointerEvent } from 'react'
import { FONTS } from '../lib/presets'
import { guessBackground, type RGB } from '../lib/pixels'
import { layoutText } from '../lib/render'
import type { ModeSpec } from '../lib/specs'
import type { BackgroundSettings, SourceImage, StickerItem } from '../lib/types'
import { ItemCanvas } from './ItemCanvas'
import { SourceThumb } from './Uploader'

interface Props {
  item: StickerItem
  index: number
  total: number
  spec: ModeSpec
  sources: SourceImage[]
  isMain: boolean
  onChange: (item: StickerItem) => void
  onBackgroundChange: (sourceId: string, bg: BackgroundSettings) => void
  onApplyToAll: (part: 'textStyle' | 'outline' | 'transform') => void
  onDuplicate: () => void
  onDelete: () => void
  onMove: (delta: -1 | 1) => void
  onSetMain: () => void
}

const toHex = (c: RGB) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
const fromHex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB

let measureCtx: CanvasRenderingContext2D | null = null

export function Editor(props: Props) {
  const { item, index, total, spec, sources, onChange } = props
  const source = sources.find((s) => s.id === item.sourceId)
  const drag = useRef<{ target: 'image' | 'text'; x: number; y: number; start: StickerItem } | null>(null)

  const toCanvas = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * spec.width, y: ((e.clientY - r.top) / r.height) * spec.height }
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const p = toCanvas(e)
    measureCtx ??= document.createElement('canvas').getContext('2d')
    const box = layoutText(measureCtx!, item, spec)?.box
    const onText = box && p.x >= box.x && p.x <= box.x + box.width && p.y >= box.y && p.y <= box.y + box.height
    drag.current = { target: onText ? 'text' : 'image', x: p.x, y: p.y, start: item }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const p = toCanvas(e)
    const dx = p.x - d.x
    const dy = p.y - d.y
    if (d.target === 'text') {
      onChange({
        ...d.start,
        text: { ...d.start.text, x: d.start.text.x + dx / spec.width, y: d.start.text.y + dy / spec.height },
      })
    } else {
      onChange({ ...d.start, transform: { ...d.start.transform, x: d.start.transform.x + dx, y: d.start.transform.y + dy } })
    }
  }

  const setT = (patch: Partial<StickerItem['transform']>) => onChange({ ...item, transform: { ...item.transform, ...patch } })
  const setText = (patch: Partial<StickerItem['text']>) => onChange({ ...item, text: { ...item.text, ...patch } })
  const setOutline = (patch: Partial<StickerItem['outline']>) => onChange({ ...item, outline: { ...item.outline, ...patch } })
  const setBg = (patch: Partial<BackgroundSettings>) =>
    source && props.onBackgroundChange(source.id, { ...source.background, ...patch })

  const pickColor = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!source) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.floor(((e.clientX - r.left) / r.width) * source.canvas.width)
    const y = Math.floor(((e.clientY - r.top) / r.height) * source.canvas.height)
    const px = source.canvas.getContext('2d')!.getImageData(x, y, 1, 1).data
    setBg({ enabled: true, color: [px[0], px[1], px[2]] })
  }

  return (
    <div className="editor">
      <div className="editor-preview">
        <div
          className="preview-stage"
          style={{ aspectRatio: `${spec.width} / ${spec.height}` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          <ItemCanvas item={item} source={source} spec={spec} className="preview-canvas" />
          <div
            className="safe-area"
            style={{
              inset: `${(spec.margin / spec.height) * 100}% ${(spec.margin / spec.width) * 100}%`,
            }}
          />
        </div>
        <p className="hint">
          {index + 1} / {total} 枚目　{spec.width}×{spec.height}px ・ 画像や文字はドラッグで移動できます（点線は余白の目安）
        </p>
        <div className="toolbar">
          <button onClick={() => props.onMove(-1)} disabled={index === 0}>
            ← 前へ
          </button>
          <button onClick={() => props.onMove(1)} disabled={index === total - 1}>
            後へ →
          </button>
          <button onClick={props.onDuplicate}>複製</button>
          <button className="danger" onClick={props.onDelete}>
            削除
          </button>
          {spec.main && (
            <button onClick={props.onSetMain} disabled={props.isMain}>
              {props.isMain ? '★ メイン画像' : 'メイン画像にする'}
            </button>
          )}
        </div>
      </div>

      <div className="editor-controls">
        <section>
          <h3>画像</h3>
          <div className="source-picker">
            {sources.map((s) => (
              <button
                key={s.id}
                className={s.id === item.sourceId ? 'on' : ''}
                onClick={() => onChange({ ...item, sourceId: s.id })}
                title={s.name}
              >
                <SourceThumb source={s} />
              </button>
            ))}
            <button className={item.sourceId === null ? 'on' : ''} onClick={() => onChange({ ...item, sourceId: null })}>
              なし
            </button>
          </div>
          <Range label="大きさ" min={0.2} max={3} step={0.01} value={item.transform.scale} onChange={(v) => setT({ scale: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Range label="回転" min={-180} max={180} step={1} value={item.transform.rotation} onChange={(v) => setT({ rotation: v })} format={(v) => `${v}°`} />
          <div className="row">
            <label className="check">
              <input type="checkbox" checked={item.transform.flipX} onChange={(e) => setT({ flipX: e.target.checked })} />
              左右反転
            </label>
            <button onClick={() => setT({ scale: 1, x: 0, y: 0, rotation: 0 })}>位置をリセット</button>
            <button className="link" onClick={() => props.onApplyToAll('transform')}>
              全てに適用
            </button>
          </div>
        </section>

        {source && (
          <section>
            <h3>背景の透過</h3>
            <p className="hint">この画像を使う全てのスタンプに反映されます。</p>
            <label className="check">
              <input type="checkbox" checked={source.background.enabled} onChange={(e) => setBg({ enabled: e.target.checked })} />
              背景を透明にする
            </label>
            <div className="bg-pick">
              <canvas
                className="checker pick-canvas"
                ref={(c) => {
                  if (!c) return
                  c.width = source.canvas.width
                  c.height = source.canvas.height
                  c.getContext('2d')!.drawImage(source.canvas, 0, 0)
                }}
                onClick={pickColor}
                title="クリックで消したい色を選択"
              />
              <div>
                <p className="hint">左の画像で消したい色をクリック</p>
                <div className="row">
                  <input type="color" value={toHex(source.background.color)} onChange={(e) => setBg({ color: fromHex(e.target.value) })} />
                  <button
                    onClick={() => {
                      const ctx = source.canvas.getContext('2d')!
                      const d = ctx.getImageData(0, 0, source.canvas.width, source.canvas.height).data
                      setBg({ enabled: true, color: guessBackground(d, source.canvas.width, source.canvas.height) })
                    }}
                  >
                    自動検出
                  </button>
                </div>
              </div>
            </div>
            <Range label="許容範囲" min={0} max={60} step={1} value={source.background.tolerance} onChange={(v) => setBg({ tolerance: v })} />
            <label className="check">
              <input type="checkbox" checked={source.background.contiguous} onChange={(e) => setBg({ contiguous: e.target.checked })} />
              外側から続く部分だけ消す（キャラの白目などを残す）
            </label>
          </section>
        )}

        <section>
          <h3>白フチ</h3>
          <div className="row">
            <label className="check">
              <input type="checkbox" checked={item.outline.enabled} onChange={(e) => setOutline({ enabled: e.target.checked })} />
              フチを付ける
            </label>
            <input type="color" value={item.outline.color} onChange={(e) => setOutline({ color: e.target.value })} />
            <button className="link" onClick={() => props.onApplyToAll('outline')}>
              全てに適用
            </button>
          </div>
          <Range label="太さ" min={1} max={16} step={1} value={item.outline.width} onChange={(v) => setOutline({ width: v })} format={(v) => `${v}px`} />
        </section>

        <section>
          <h3>文字</h3>
          <textarea rows={2} value={item.text.content} placeholder="セリフ（改行で2行に）" onChange={(e) => setText({ content: e.target.value })} />
          <div className="row">
            <select value={item.text.font} onChange={(e) => setText({ font: e.target.value })}>
              {FONTS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <label className="color">
              文字
              <input type="color" value={item.text.color} onChange={(e) => setText({ color: e.target.value })} />
            </label>
            <label className="color">
              フチ
              <input type="color" value={item.text.strokeColor} onChange={(e) => setText({ strokeColor: e.target.value })} />
            </label>
          </div>
          <Range label="サイズ" min={12} max={120} step={1} value={item.text.size} onChange={(v) => setText({ size: v })} format={(v) => `${v}px`} />
          <Range label="フチの太さ" min={0} max={20} step={1} value={item.text.strokeWidth} onChange={(v) => setText({ strokeWidth: v })} format={(v) => `${v}px`} />
          <Range label="傾き" min={-45} max={45} step={1} value={item.text.rotation} onChange={(v) => setText({ rotation: v })} format={(v) => `${v}°`} />
          <div className="row">
            <span className="label">位置</span>
            <button onClick={() => setText({ x: 0.5, y: 0.16 })}>上</button>
            <button onClick={() => setText({ x: 0.5, y: 0.5 })}>中央</button>
            <button onClick={() => setText({ x: 0.5, y: 0.84 })}>下</button>
            <button className="link" onClick={() => props.onApplyToAll('textStyle')}>
              文字の見た目を全てに適用
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

interface RangeProps {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  format?: (v: number) => string
}

function Range({ label, min, max, step, value, onChange, format }: RangeProps) {
  return (
    <label className="range">
      <span className="label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="value">{format ? format(value) : value}</span>
    </label>
  )
}
