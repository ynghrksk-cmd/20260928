import type { AnimationSettings } from './animation'
import type { RGB } from './pixels'

export interface BackgroundSettings {
  enabled: boolean
  color: RGB
  /** 0〜100 */
  tolerance: number
  contiguous: boolean
}

export interface SourceImage {
  id: string
  name: string
  /** 読み込み時に縮小済みの元画像 */
  canvas: HTMLCanvasElement
  background: BackgroundSettings
}

export interface ImageTransform {
  /** 1 = セーフエリアにちょうど収まる大きさ */
  scale: number
  /** キャンバス中心からのずれ（出力 px） */
  x: number
  y: number
  /** 度 */
  rotation: number
  flipX: boolean
}

export interface TextSettings {
  content: string
  font: string
  /** 出力 px */
  size: number
  color: string
  strokeColor: string
  strokeWidth: number
  /** キャンバス上の中心位置（0〜1 の割合） */
  x: number
  y: number
  rotation: number
}

export interface OutlineSettings {
  enabled: boolean
  width: number
  color: string
}

export interface StickerItem {
  id: string
  sourceId: string | null
  transform: ImageTransform
  text: TextSettings
  outline: OutlineSettings
  /** アニメスタンプのみ */
  animation?: AnimationSettings
}
