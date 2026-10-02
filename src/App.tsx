import { useEffect, useState } from 'react'
import { Editor } from './components/Editor'
import { ItemCanvas } from './components/ItemCanvas'
import { SetGenerator } from './components/SetGenerator'
import { Uploader } from './components/Uploader'
import { exportZip } from './lib/exportZip'
import { ensureFonts } from './lib/fonts'
import { generateSet, newId, newItem } from './lib/presets'
import { SPECS, type Mode } from './lib/specs'
import { clearProject, loadProject, saveProject } from './lib/storage'
import type { BackgroundSettings, SourceImage, StickerItem } from './lib/types'

export default function App() {
  const [mode, setMode] = useState<Mode>('stamp')
  const [count, setCount] = useState(8)
  const [sources, setSources] = useState<SourceImage[]>([])
  const [items, setItems] = useState<StickerItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mainId, setMainId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [restored, setRestored] = useState(false)
  const [saveError, setSaveError] = useState('')

  // 前回の作業を復元
  useEffect(() => {
    loadProject()
      .then((p) => {
        if (!p || (!p.sources.length && !p.items.length)) return
        setMode(p.mode)
        setCount(p.count)
        setSources(p.sources)
        setItems(p.items)
        setSelectedId(p.selectedId)
        setMainId(p.mainId)
        setRestored(true)
      })
      .catch(() => setSaveError('前回の作業を読み込めませんでした'))
      .finally(() => setLoaded(true))
  }, [])

  // 変更があるたびに少し待ってから自動保存
  useEffect(() => {
    if (!loaded) return
    const timer = setTimeout(() => {
      saveProject({ mode, count, sources, items, selectedId, mainId })
        .then(() => setSaveError(''))
        .catch(() => setSaveError('自動保存に失敗しました（ブラウザの保存容量が不足している可能性があります）'))
    }, 600)
    return () => clearTimeout(timer)
  }, [loaded, mode, count, sources, items, selectedId, mainId])

  const startOver = async () => {
    if (!confirm('画像とスタンプをすべて消して、最初から作り直します。よろしいですか？')) return
    await clearProject().catch(() => {})
    setSources([])
    setItems([])
    setSelectedId(null)
    setMainId(null)
    setWarnings([])
    setRestored(false)
  }

  const spec = SPECS[mode]
  const selectedIndex = items.findIndex((i) => i.id === selectedId)
  const selected = items[selectedIndex]
  const mainIndex = Math.max(0, items.findIndex((i) => i.id === mainId))
  const findSource = (id: string | null) => sources.find((s) => s.id === id)

  const switchMode = (m: Mode) => {
    if (m === mode) return
    if (items.length && !confirm(`${SPECS[m].label}モードに切り替えると、作成中の${spec.label}は消えます。よろしいですか？`)) return
    setMode(m)
    setItems([])
    setSelectedId(null)
    setCount(SPECS[m].counts[0])
  }

  const updateItem = (next: StickerItem) => setItems((list) => list.map((i) => (i.id === next.id ? next : i)))

  const updateBackground = (sourceId: string, background: BackgroundSettings) =>
    setSources((list) => list.map((s) => (s.id === sourceId ? { ...s, background } : s)))

  const removeSource = (id: string) => {
    setSources((list) => list.filter((s) => s.id !== id))
    setItems((list) => list.map((i) => (i.sourceId === id ? { ...i, sourceId: null } : i)))
  }

  const replaceSource = (id: string, parts: SourceImage[]) => {
    setSources((list) => list.flatMap((s) => (s.id === id ? parts : [s])))
    setItems((list) => list.map((i) => (i.sourceId === id ? { ...i, sourceId: parts[0]?.id ?? null } : i)))
  }

  const generate = (phrases: string[], colorful: boolean) => {
    const set = generateSet(mode, count, sources.map((s) => s.id), phrases, colorful)
    setItems(set)
    setSelectedId(set[0]?.id ?? null)
    setMainId(set[0]?.id ?? null)
    setWarnings([])
  }

  const addItem = () => {
    const item = newItem(mode, selected?.sourceId ?? sources[0]?.id ?? null)
    setItems((list) => [...list, item])
    setSelectedId(item.id)
  }

  const applyToAll = (part: 'textStyle' | 'outline' | 'transform') => {
    if (!selected) return
    setItems((list) =>
      list.map((i) => {
        if (part === 'outline') return { ...i, outline: { ...selected.outline } }
        if (part === 'transform') return { ...i, transform: { ...selected.transform } }
        return { ...i, text: { ...selected.text, content: i.text.content } }
      }),
    )
  }

  const duplicate = () => {
    if (!selected) return
    const copy = { ...structuredClone(selected), id: newId() }
    setItems((list) => [...list.slice(0, selectedIndex + 1), copy, ...list.slice(selectedIndex + 1)])
    setSelectedId(copy.id)
  }

  const remove = () => {
    if (!selected) return
    const next = items[selectedIndex + 1] ?? items[selectedIndex - 1]
    setItems((list) => list.filter((i) => i.id !== selected.id))
    setSelectedId(next?.id ?? null)
  }

  const move = (delta: -1 | 1) => {
    const j = selectedIndex + delta
    if (j < 0 || j >= items.length) return
    const list = [...items]
    ;[list[selectedIndex], list[j]] = [list[j], list[selectedIndex]]
    setItems(list)
  }

  const download = async () => {
    setExporting(true)
    try {
      await ensureFonts(items.map((i) => i.text))
      const { blob, warnings } = await exportZip(mode, items, sources, mainIndex)
      setWarnings(warnings)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = mode === 'stamp' ? 'line_stamps.zip' : 'line_emoji.zip'
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    } catch (e) {
      setWarnings([`書き出しに失敗しました: ${(e as Error).message}`])
    } finally {
      setExporting(false)
    }
  }

  const countOk = spec.counts.includes(items.length)

  return (
    <div className="app">
      <header>
        <h1>LINEスタンプ・絵文字メーカー</h1>
        <div className="mode-switch" role="tablist">
          {(Object.keys(SPECS) as Mode[]).map((m) => (
            <button key={m} role="tab" aria-selected={m === mode} className={m === mode ? 'on' : ''} onClick={() => switchMode(m)}>
              {SPECS[m].label}
              <small>
                {SPECS[m].width}×{SPECS[m].height}
              </small>
            </button>
          ))}
        </div>
      </header>
      <div className="privacy">
        <span>画像はブラウザの中だけで処理・保存され、サーバーには送信されません。作業内容は自動で保存されます。</span>
        {(sources.length > 0 || items.length > 0) && (
          <button className="link" onClick={startOver}>
            最初から作り直す
          </button>
        )}
      </div>
      {restored && (
        <div className="notice">
          前回の作業を復元しました。
          <button className="icon" onClick={() => setRestored(false)} aria-label="閉じる">
            ×
          </button>
        </div>
      )}
      {saveError && <p className="error">{saveError}</p>}

      <section className="card">
        <h2>
          <span className="step">1</span>画像をアップロード
        </h2>
        <Uploader sources={sources} onAdd={(s) => setSources((list) => [...list, ...s])} onRemove={removeSource} onReplace={replaceSource} />
      </section>

      <section className="card">
        <h2>
          <span className="step">2</span>セリフを選んで一括生成
        </h2>
        <SetGenerator
          spec={spec}
          count={count}
          onCountChange={setCount}
          hasItems={items.length > 0}
          hasSources={sources.length > 0}
          onGenerate={generate}
        />
      </section>

      {items.length > 0 && (
        <section className="card">
          <h2>
            <span className="step">3</span>1枚ずつ仕上げる
          </h2>
          <div className="grid">
            {items.map((item, i) => (
              <button
                key={item.id}
                className={`tile ${item.id === selectedId ? 'on' : ''}`}
                onClick={() => setSelectedId(item.id)}
                aria-label={`${i + 1}枚目を編集`}
              >
                <ItemCanvas item={item} source={findSource(item.sourceId)} spec={spec} />
                <span className="num">{i + 1}</span>
                {spec.main && i === mainIndex && <span className="badge">メイン</span>}
              </button>
            ))}
            <button className="tile add" onClick={addItem}>
              ＋ 追加
            </button>
          </div>
          {selected && (
            <Editor
              item={selected}
              index={selectedIndex}
              total={items.length}
              spec={spec}
              sources={sources}
              isMain={selectedIndex === mainIndex}
              onChange={updateItem}
              onBackgroundChange={updateBackground}
              onApplyToAll={applyToAll}
              onDuplicate={duplicate}
              onDelete={remove}
              onMove={move}
              onSetMain={() => setMainId(selected.id)}
            />
          )}
        </section>
      )}

      {items.length > 0 && (
        <section className="card">
          <h2>
            <span className="step">4</span>ZIPでダウンロード
          </h2>
          <ul className="checklist">
            <li className={countOk ? 'ok' : 'ng'}>
              枚数: {items.length} 枚（{mode === 'stamp' ? spec.counts.join(' / ') + ' 枚' : '8〜40 個'}）
            </li>
            <li className="ok">
              {spec.label}画像: {spec.fileName(1)} 〜 {spec.fileName(items.length)}
              {spec.trim ? `（最大 ${spec.width}×${spec.height}px、余白を自動で詰めて偶数サイズに）` : `（${spec.width}×${spec.height}px）`}
            </li>
            {spec.main && <li className="ok">メイン画像: main.png（240×240px、{mainIndex + 1}枚目から作成）</li>}
            <li className="ok">タブ画像: tab.png（96×74px）</li>
          </ul>
          <button className="primary" onClick={download} disabled={exporting}>
            {exporting ? '作成中…' : 'ZIPをダウンロード'}
          </button>
          {warnings.length > 0 && (
            <ul className="warnings">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <p className="hint">
            ダウンロードしたZIPは、そのまま LINE Creators Market の「ZIPファイルでアップロード」から登録できます。
          </p>
        </section>
      )}
    </div>
  )
}
