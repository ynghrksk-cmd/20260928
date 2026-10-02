import { useState } from 'react'
import { PHRASE_GROUPS } from '../lib/presets'
import type { ModeSpec } from '../lib/specs'

interface Props {
  spec: ModeSpec
  count: number
  onCountChange: (n: number) => void
  hasItems: boolean
  hasSources: boolean
  onGenerate: (phrases: string[], colorful: boolean) => void
}

export function SetGenerator({ spec, count, onCountChange, hasItems, hasSources, onGenerate }: Props) {
  const [selected, setSelected] = useState<string[]>(PHRASE_GROUPS[0].phrases.concat(PHRASE_GROUPS[1].phrases))
  const [custom, setCustom] = useState('')
  const [noText, setNoText] = useState(false)
  const [colorful, setColorful] = useState(true)

  const toggle = (p: string) =>
    setSelected((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]))

  const customPhrases = custom
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const phrases = noText ? [] : [...selected, ...customPhrases]

  const generate = () => {
    if (hasItems && !confirm('いまのスタンプを置き換えて一括生成します。よろしいですか？')) return
    onGenerate(phrases, colorful)
  }

  return (
    <div className="generator">
      <div className="row">
        <label>
          作成枚数
          <select value={count} onChange={(e) => onCountChange(Number(e.target.value))}>
            {spec.counts.map((n) => (
              <option key={n} value={n}>
                {n} 枚
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={noText} onChange={(e) => setNoText(e.target.checked)} />
          文字なしで作る
        </label>
        <label className="check">
          <input type="checkbox" checked={colorful} onChange={(e) => setColorful(e.target.checked)} />
          文字色をカラフルに
        </label>
      </div>

      {!noText && (
        <>
          {PHRASE_GROUPS.map((g) => (
            <div key={g.label} className="phrase-group">
              <div className="phrase-group-head">
                <span>{g.label}</span>
                <button
                  className="link"
                  onClick={() => {
                    const all = g.phrases.every((p) => selected.includes(p))
                    setSelected((s) =>
                      all ? s.filter((p) => !g.phrases.includes(p)) : [...new Set([...s, ...g.phrases])],
                    )
                  }}
                >
                  まとめて切替
                </button>
              </div>
              <div className="chips">
                {g.phrases.map((p) => (
                  <button
                    key={p}
                    className={`chip ${selected.includes(p) ? 'on' : ''}`}
                    onClick={() => toggle(p)}
                    aria-pressed={selected.includes(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <label className="block">
            オリジナルのセリフ（1行に1つ）
            <textarea
              rows={3}
              value={custom}
              placeholder={'例）\nがんばったね\n今日もえらい'}
              onChange={(e) => setCustom(e.target.value)}
            />
          </label>
        </>
      )}

      <p className="hint">
        選んだセリフ {phrases.length} 個 × 画像を順番に組み合わせて {count} 枚作ります。
        {phrases.length > 0 && phrases.length < count && ' セリフが足りない分は先頭から繰り返します。'}
      </p>
      <button className="primary" disabled={!hasSources} onClick={generate}>
        {count} 枚を一括生成
      </button>
      {!hasSources && <p className="hint">先に画像をアップロードしてください。</p>}
    </div>
  )
}
