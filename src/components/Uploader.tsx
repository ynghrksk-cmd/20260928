import { useMemo, useRef, useState } from 'react'
import { guessBackground } from '../lib/pixels'
import { newId } from '../lib/presets'
import { imageToCanvas } from '../lib/render'
import type { SourceImage } from '../lib/types'

interface Props {
  sources: SourceImage[]
  onAdd: (sources: SourceImage[]) => void
  onRemove: (id: string) => void
}

async function loadFile(file: File): Promise<SourceImage> {
  const bitmap = await createImageBitmap(file)
  const canvas = imageToCanvas(bitmap)
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

export function Uploader({ sources, onAdd, onRemove }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')

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
        <small>別のAIで作ったポーズ違いの画像をまとめて追加できます</small>
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
      {sources.length > 0 && (
        <ul className="source-list">
          {sources.map((s) => (
            <li key={s.id}>
              <SourceThumb source={s} />
              <span title={s.name}>{s.name}</span>
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
