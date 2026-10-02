import { useMemo, useRef, useState } from 'react'
import { guessBackground } from '../lib/pixels'
import { newId } from '../lib/presets'
import { imageToCanvas } from '../lib/render'
import type { SourceImage } from '../lib/types'
import { SplitDialog } from './SplitDialog'

interface Props {
  sources: SourceImage[]
  onAdd: (sources: SourceImage[]) => void
  onRemove: (id: string) => void
  onReplace: (id: string, parts: SourceImage[]) => void
}

async function loadFile(file: File): Promise<SourceImage> {
  const bitmap = await createImageBitmap(file)
  // 一覧画像を分割しても十分な解像度が残るよう、大きめに保持する
  const canvas = imageToCanvas(bitmap, 2048)
  bitmap.close()
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  // 四隅が透明ならすでに透過済みの画像とみなす
  const transparent = [0, canvas.width - 1].some((x) => data[x * 4 + 3] < 10)
  return {
    id: newId(),
    name: file.name,
    canvas,
    background: {
      enabled: !transparent,
      color: guessBackground(data, canvas.width, canvas.height),
      tolerance: 12,
      contiguous: true,
    },
  }
}

export function Uploader({ sources, onAdd, onRemove, onReplace }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [splitting, setSplitting] = useState<SourceImage | null>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setError('')
    const images = [...files].filter((f) => f.type.startsWith('image/'))
    const results = await Promise.allSettled(images.map(loadFile))
    const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
    if (ok.length < files.length) setError('読み込めなかったファイルがあります（PNG / JPEG / WebP に対応）')
    if (ok.length) onAdd(ok)
  }

  return (
    <div>
      <div
        className={`dropzone ${dragging ? 'dragging' : ''}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
      >
        <strong>ここに画像をドロップ</strong>
        <span>またはクリックして選択（複数可）</span>
        <small>別のAIで作ったポーズ違いの画像をまとめて追加できます。ポーズ一覧の1枚画像は「分割」で切り分けられます</small>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {error && <p className="error">{error}</p>}
      {splitting && (
        <SplitDialog
          source={splitting}
          onCancel={() => setSplitting(null)}
          onSplit={(parts) => {
            onReplace(splitting.id, parts)
            setSplitting(null)
          }}
        />
      )}
      {sources.length > 0 && (
        <ul className="source-list">
          {sources.map((s) => (
            <li key={s.id}>
              <SourceThumb source={s} />
              <span title={s.name}>{s.name}</span>
              <button className="small" onClick={() => setSplitting(s)}>
                分割
              </button>
              <button className="icon" onClick={() => onRemove(s.id)} aria-label={`${s.name} を削除`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function SourceThumb({ source }: { source: SourceImage }) {
  const src = useMemo(() => source.canvas.toDataURL('image/png'), [source.canvas])
  return (
    <img
      className="checker"
      src={src}
      alt={source.name}
      draggable={false}
    />
  )
}
