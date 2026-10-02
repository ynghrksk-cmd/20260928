// LINE Creators Market の画像ガイドラインに基づく規格
export type Mode = 'stamp' | 'emoji'

export interface ModeSpec {
  label: string
  /** 1枚あたりの最大サイズ（キャンバスサイズ） */
  width: number
  height: number
  /** 上下左右に確保する余白 */
  margin: number
  /** 選択可能なセット枚数 */
  counts: number[]
  /** ZIP 内のファイル名（1始まりの番号から） */
  fileName: (index: number) => string
  /** メイン画像（スタンプのみ） */
  main?: { width: number; height: number }
  tab: { width: number; height: number }
  /** 出力時に内容に合わせて余白を詰めるか */
  trim: boolean
}

export const SPECS: Record<Mode, ModeSpec> = {
  stamp: {
    label: 'スタンプ',
    width: 370,
    height: 320,
    margin: 10,
    counts: [8, 16, 24, 32, 40],
    fileName: (i) => `${String(i).padStart(2, '0')}.png`,
    main: { width: 240, height: 240 },
    tab: { width: 96, height: 74 },
    trim: true,
  },
  emoji: {
    label: '絵文字',
    width: 180,
    height: 180,
    margin: 6,
    counts: Array.from({ length: 33 }, (_, i) => i + 8),
    fileName: (i) => `${String(i).padStart(3, '0')}.png`,
    tab: { width: 96, height: 74 },
    trim: false,
  },
}
