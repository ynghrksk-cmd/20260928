import { useEffect, useState } from 'react'
import { Editor } from './components/Editor'
import { ConvertDialog } from './components/ConvertDialog'
import { ItemCanvas } from './components/ItemCanvas'
import { SetGenerator } from './components/SetGenerator'
import { Uploader } from './components/Uploader'
import { convertSet } from './lib/convertSet'
import { exportZip } from './lib/exportZip'
import { ensureFonts } from './lib/fonts'
import { generateSet, newId, newItem } from './lib/presets'
import { SPECS, type Mode } from './lib/specs'
import { clearProject, loadProject, saveProject } from './lib/storage'
import type { BackgroundSettings, ModeSet, SourceImage, StickerItem } from './lib/types'

export default function App() {
  const [mode, setMode] = useState<Mode>('stamp')
  const [count, setCount] = useState(8)
  const [sources, setSources] = useState<SourceImage[]>([])
  const [items, setItems] = useState<StickerItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mainId, setMainId] = useState<string | null>(null)
  const [exporting, setExporting] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [restored, setRestored] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [stash, setStash] = useState<Partial<Record<Mode, ModeSet>>>({})
  const [converting, setConverting] = useState<Mode | null>(null)
  const [notice, setNotice] = useState('')

  // 前回の作業を復元
  useEffect(() => {
    loadProject()
      .then((p) => {
        const stashed = Object.values(p?.stash ?? {}).some((set) => set?.items.length)
        if (!p || (!p.sources.length && !p.items.length && !stashed)) return
        setMode(p.mode)
        setCount(p.count)
        setSources(p.sources)
        setItems(p.items)
        setSelectedId(p.selectedId)
        setMainId(p.mainId)
        setStash(p.stash ?? {})
        setRestored(true)
      })
      .catch(() => setSaveError('前回の作業を読み込めませんでした'))
      .finally(() => setLoaded(true))
  }, [])

  // 変更があるたびに少し待ってから自動保存
  useEffect(() => {
    if (!loaded) return
    const timer = setTimeout(() => {
      saveProject({ mode, count, sources, items, selectedId, mainId, stash })
        .then(() => setSaveError(''))
        .catch(() => setSaveError('自動保存に失敗しました（ブラウザの保存容量が不足している可能性があります）'))
    }, 600)
    return () => clearTimeout(timer)
  }, [loaded, mode, count, sources, items, selectedId, mainId, stash])

  const startOver = async () => {
    if (!confirm('画像とスタンプをすべて消して、最初から作り直します。よろしいですか？')) return
    await clearProject().catch(() => {})
    setSources([])
    setItems([])
    setSelectedId(null)
    setMainId(null)
    setStash({})
    setWarnings([])
    setRestored(false)
    setNotice('')
  }

  const spec = SPECS[mode]
  const selectedIndex = items.findIndex((i) => i.id === selectedId)
  const selected = items[selectedIndex]
  const mainIndex = Math.max(0, items.findIndex((i) => i.id === mainId))
  const findSource = (id: string | null) => sources.find((s) => s.id === id)

  /** モードを切り替える。いまの作業内容は取っておき、切り替え先の作業内容を戻す */
  const switchMode = (m: Mode, next: ModeSet | undefined = stash[m]) => {
    if (m === mode && !next) return
    setStash((s) => ({ ...s, [mode]: { items, selectedId, mainId, count }, [m]: undefined }))
    setMode(m)
    setItems(next?.items ?? [])
    setSelectedId(next?.selectedId ?? next?.items[0]?.id ?? null)
    setMainId(next?.mainId ?? null)
    setCount(next?.count ?? SPECS[m].counts[0])
    setWarnings([])
    setNotice('')
  }

  /** 作業中のモード・取っておいたモードの両方のスタンプに同じ変更を加える */
  const mapAllItems = (fn: (i: StickerItem) => StickerItem) => {
    setItems((list) => list.map(fn))
    setStash((s) =>
      Object.fromEntries(Object.entries(s).map(([m, set]) => [m, set && { ...set, items: set.items.map(fn) }])),
    )
  }

  const itemsOf = (m: Mode) => (m === mode ? items : (stash[m]?.items ?? []))

  /** スタンプ（またはアニメスタンプ）を絵文字に変換し、絵文字モードに切り替える */
  const convertToEmoji = async (from: Mode, keepText: boolean) => {
    const converted = await convertSet(itemsOf(from).slice(0, 40), sources, SPECS[from], SPECS.emoji, keepText)
    switchMode('emoji', {
      items: converted,
      selectedId: converted[0]?.id ?? null,
      mainId: null,
      count: Math.min(40, Math.max(8, converted.length)),
    })
    setConverting(null)
    setNotice(`${SPECS[from].label} ${converted.length} 枚を絵文字に変換しました。小さく表示されるので、1つずつ見え方を確認してください。`)
  }

  const convertibleFrom = (['stamp', 'anim'] as Mode[]).filter((m) => itemsOf(m).length > 0)

  const updateItem = (next: StickerItem) => setItems((list) => list.map((i) => (i.id === next.id ? next : i)))

  const updateBackground = (sourceId: string, background: BackgroundSettings) =>
    setSources((list) => list.map((s) => (s.id === sourceId ? { ...s, background } : s)))

  const removeSource = (id: string) => {
    setSources((list) => list.filter((s) => s.id !== id))
    mapAllItems((i) => (i.sourceId === id ? { ...i, sourceId: null } : i))
  }

  const replaceSource = (id: string, parts: SourceImage[]) => {
    setSources((list) => list.flatMap((s) => (s.id === id ? parts : [s])))
    mapAllItems((i) => (i.sourceId === id ? { ...i, sourceId: parts[0]?.id ?? null } : i))
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

  const applyToAll = (part: 'textStyle' | 'outline' | 'transform' | 'animation') => {
    if (!selected) return
    setItems((list) =>
      list.map((i) => {
        if (part === 'outline') return { ...i, outline: { ...selected.outline } }
        if (part === 'transform') return { ...i, transform: { ...selected.transform } }
        if (part === 'animation') return { ...i, animation: selected.animation && { ...selected.animation, flipbookSources: [] } }
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
    setExporting('作成中…')
    try {
      await ensureFonts(items.map((i) => i.text))
      const { blob, warnings } = await exportZip(mode, items, sources, mainIndex, (done, total) =>
        setExporting(`作成中… ${done + 1} / ${total}`),
      )
      setWarnings(warnings)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = { stamp: 'line_stamps.zip', anim: 'line_animation_stamps.zip', emoji: 'line_emoji.zip' }[mode]
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    } catch (e) {
      setWarnings([`書き出しに失敗しました: ${(e as Error).message}`])
    } finally {
      setExporting('')
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
      {notice && (
        <div className="notice">
          {notice}
          <button className="icon" onClick={() => setNotice('')} aria-label="閉じる">
            ×
          </button>
        </div>
      )}
      {mode === 'emoji' && convertibleFrom.length > 0 && (
        <div className="convert-banner">
          <span>作成済みのスタンプから絵文字を作れます。</span>
          {convertibleFrom.map((m) => (
            <button key={m} onClick={() => setConverting(m)}>
              {SPECS[m].label}（{itemsOf(m).length}枚）から変換
            </button>
          ))}
        </div>
      )}
      {converting && (
        <ConvertDialog
          from={converting}
          count={itemsOf(converting).length}
          existing={mode === 'emoji' ? items.length : (stash.emoji?.items.length ?? 0)}
          onCancel={() => setConverting(null)}
          onConvert={(keepText) => convertToEmoji(converting, keepText)}
        />
      )}

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
              枚数: {items.length} 枚（{mode === 'emoji' ? '8〜40 個' : spec.counts.join(' / ') + ' 枚'}）
            </li>
            <li className="ok">
              {spec.label}画像: {spec.fileName(1)} 〜 {spec.fileName(items.length)}
              {spec.trim
                ? `（最大 ${spec.width}×${spec.height}px、余白を自動で詰めて偶数サイズに）`
                : `（${spec.width}×${spec.height}px${spec.animated ? '・APNG、1ファイル300KB以内' : ''}）`}
            </li>
            {spec.main && <li className="ok">メイン画像: main.png（240×240px{spec.animated ? '・APNG' : ''}、{mainIndex + 1}枚目から作成）</li>}
            <li className="ok">タブ画像: tab.png（96×74px）</li>
          </ul>
          <button className="primary" onClick={download} disabled={!!exporting}>
            {exporting || 'ZIPをダウンロード'}
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
          {mode !== 'emoji' && (
            <div className="convert-box">
              <h3>このスタンプを絵文字にもする</h3>
              <p className="hint">
                作成した{spec.label}を、絵文字（180×180px）の規格に合わせて作り直します。元の{spec.label}は残ります。
              </p>
              <button onClick={() => setConverting(mode)}>絵文字に変換…</button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
