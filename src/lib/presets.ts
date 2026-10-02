import type { Mode } from './specs'
import type { StickerItem, TextSettings } from './types'

export const FONTS = [
  { value: '"M PLUS Rounded 1c"', label: 'まるゴシック', weight: 800 },
  { value: '"Dela Gothic One"', label: '極太ゴシック', weight: 400 },
  { value: '"Yusei Magic"', label: '手書き風', weight: 400 },
  { value: '"RocknRoll One"', label: 'ポップ', weight: 400 },
  { value: '"Kaisei Decol"', label: '明朝風', weight: 700 },
]

export const PHRASE_GROUPS: { label: string; phrases: string[] }[] = [
  {
    label: 'あいさつ',
    phrases: ['おはよう', 'こんにちは', 'おやすみ', 'またね', 'ただいま', 'おかえり', 'いってきます', 'いってらっしゃい'],
  },
  {
    label: '返事',
    phrases: ['OK!', '了解！', 'はーい', 'NO!', 'いいね！', 'なるほど', 'ちょっと待って', 'りょ'],
  },
  {
    label: '感謝・おわび',
    phrases: ['ありがとう', 'ありがとうございます', 'ごめんね', 'すみません', '助かります', 'よろしく！', 'よろしくお願いします', 'おねがい'],
  },
  {
    label: '気持ち',
    phrases: ['うれしい！', 'かなしい…', 'すごい！', 'えっ！？', '笑', 'ぴえん', '楽しみ！', 'おこ'],
  },
  {
    label: 'はげまし・ていねい',
    phrases: ['おつかれさま', 'がんばって！', 'ファイト！', 'おめでとう！', '大丈夫？', '承知しました', 'お疲れさまです', 'ナイス！'],
  },
]

export const ALL_PHRASES = PHRASE_GROUPS.flatMap((g) => g.phrases)

export const newId = () => Math.random().toString(36).slice(2, 10)

export function defaultText(mode: Mode, content = ''): TextSettings {
  return {
    content,
    font: FONTS[0].value,
    size: mode === 'stamp' ? 52 : 34,
    color: '#ff5a8a',
    strokeColor: '#ffffff',
    strokeWidth: mode === 'stamp' ? 10 : 6,
    x: 0.5,
    y: mode === 'stamp' ? 0.84 : 0.8,
    rotation: 0,
  }
}

export function newItem(mode: Mode, sourceId: string | null, content = ''): StickerItem {
  return {
    id: newId(),
    sourceId,
    transform: { scale: 1, x: 0, y: 0, rotation: 0, flipX: false },
    text: defaultText(mode, content),
    outline: { enabled: true, width: mode === 'stamp' ? 6 : 4, color: '#ffffff' },
  }
}

const imageOffsetY = (mode: Mode) => (mode === 'stamp' ? 22 : 12)

const TEXT_COLORS = ['#ff5a8a', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444']

/** 選んだセリフと画像を組み合わせて、指定枚数のスタンプを作る */
export function generateSet(
  mode: Mode,
  count: number,
  sourceIds: string[],
  phrases: string[],
  colorful: boolean,
): StickerItem[] {
  return Array.from({ length: count }, (_, i) => {
    const sourceId = sourceIds.length ? sourceIds[i % sourceIds.length] : null
    const phrase = phrases.length ? phrases[i % phrases.length] : ''
    const item = newItem(mode, sourceId, phrase)
    // セリフがある場合は画像を少し小さくして上に寄せ、文字の場所を空ける
    if (phrase) item.transform = { ...item.transform, scale: 0.82, y: -imageOffsetY(mode) }
    if (colorful) item.text.color = TEXT_COLORS[i % TEXT_COLORS.length]
    return item
  })
}
