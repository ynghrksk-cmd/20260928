import { useState } from 'react'
import { SPECS, type Mode } from '../lib/specs'

interface Props {
  from: Mode
  count: number
  /** 変換先にすでに作成済みの数 */
  existing: number
  onCancel: () => void
  onConvert: (keepText: boolean) => Promise<void>
}

export function ConvertDialog({ from, count, existing, onCancel, onConvert }: Props) {
  const [keepText, setKeepText] = useState(true)
  const [busy, setBusy] = useState(false)
  const emoji = SPECS.emoji
  const tooMany = count > 40

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="modal" role="dialog" aria-label="絵文字に変換" onClick={(e) => e.stopPropagation()}>
        <h2>絵文字に変換</h2>
        <p className="hint">
          作成した{SPECS[from].label} {count} 枚を、絵文字（{emoji.width}×{emoji.height}px）に作り直します。
          内容が絵文字の枠いっぱいに収まるよう、大きさと位置を自動で調整します。
          {from === 'anim' && ' アニメーションは外れ、最後のフレーム（基本の姿勢）で静止画になります。'}
        </p>
        <fieldset className="options">
          <label className="check">
            <input type="radio" checked={keepText} onChange={() => setKeepText(true)} />
            文字もそのまま残す
          </label>
          <label className="check">
            <input type="radio" checked={!keepText} onChange={() => setKeepText(false)} />
            文字を消して、画像を大きくする（小さく表示される絵文字ではこちらが見やすいことが多いです）
          </label>
        </fieldset>
        {tooMany && <p className="error">絵文字は最大 40 個です。先頭の 40 枚だけを変換します。</p>}
        {existing > 0 && <p className="error">作成中の絵文字 {existing} 個は、変換した絵文字で置き換わります。</p>}
        <p className="hint">元の{SPECS[from].label}はそのまま残ります。上のタブでいつでも切り替えられます。</p>
        <div className="row end">
          <button onClick={onCancel} disabled={busy}>
            キャンセル
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConvert(keepText)
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? '変換中…' : `${Math.min(count, 40)} 個の絵文字に変換`}
          </button>
        </div>
      </div>
    </div>
  )
}
