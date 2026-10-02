// アニメーションスタンプの動き（Canvas 非依存の純粋関数）

export type AnimationPreset = 'bounce' | 'sway' | 'pulse' | 'shake' | 'textPop' | 'flipbook'

export interface AnimationSettings {
  preset: AnimationPreset
  /** フレーム数（5〜20） */
  frames: number
  /** 1ループの秒数 */
  duration: number
  /** ループ回数（1〜4） */
  loops: number
  /** パラパラ用：基本画像のあとに切り替える画像 */
  flipbookSources: string[]
}

export const ANIMATION_PRESETS: { value: AnimationPreset; label: string }[] = [
  { value: 'bounce', label: 'ぴょんぴょん' },
  { value: 'sway', label: 'ゆらゆら' },
  { value: 'pulse', label: 'ドキドキ' },
  { value: 'shake', label: 'ブルブル' },
  { value: 'textPop', label: '文字ポップ' },
  { value: 'flipbook', label: 'パラパラ（画像切り替え）' },
]

export const ANIMATION_LIMITS = { minFrames: 5, maxFrames: 20, maxTotalSeconds: 4, maxLoops: 4 }

export function defaultAnimation(preset: AnimationPreset = 'bounce'): AnimationSettings {
  return { preset, frames: 12, duration: 1, loops: 2, flipbookSources: [] }
}

/** 1フレームの表示時間（1/100 秒）。LINE の規定（合計 4 秒以内）を超えないよう切り捨てる */
export function frameDelay(a: AnimationSettings): number {
  return Math.max(1, Math.floor((a.duration * 100) / a.frames))
}

/** 規定内に収まるよう値を補正する */
export function normalizeAnimation(a: AnimationSettings): AnimationSettings {
  const frames = Math.min(ANIMATION_LIMITS.maxFrames, Math.max(ANIMATION_LIMITS.minFrames, Math.round(a.frames)))
  const duration = Math.min(ANIMATION_LIMITS.maxTotalSeconds, Math.max(frames * 0.02, a.duration))
  const maxLoops = Math.max(1, Math.min(ANIMATION_LIMITS.maxLoops, Math.floor(ANIMATION_LIMITS.maxTotalSeconds / duration + 1e-9)))
  const loops = Math.min(maxLoops, Math.max(1, Math.round(a.loops)))
  return { ...a, frames, duration, loops }
}

/** 1フレーム分の変化量（基本の配置に足し合わせる） */
export interface FrameState {
  x: number
  y: number
  rotation: number
  scale: number
  textScale: number
  /** 使う画像の番号（0 = 基本画像、1〜 = flipbookSources） */
  sourceIndex: number
}

const NEUTRAL: FrameState = { x: 0, y: 0, rotation: 0, scale: 1, textScale: 1, sourceIndex: 0 }

/**
 * index 番目（0 始まり）のフレームの状態。
 * LINE では再生後に最後のフレームが表示されたままになるため、
 * 最後のフレームが基本の姿勢になるように t = (index + 1) / frames とする。
 */
export function frameState(a: AnimationSettings, index: number, size: number): FrameState {
  const t = (index + 1) / a.frames
  const wave = Math.sin(t * Math.PI * 2)
  switch (a.preset) {
    case 'bounce':
      return { ...NEUTRAL, y: -Math.abs(Math.sin(t * Math.PI * 2)) * size * 0.08 }
    case 'sway':
      return { ...NEUTRAL, rotation: wave * 8 }
    case 'pulse':
      return { ...NEUTRAL, scale: 1 + Math.abs(Math.sin(t * Math.PI * 2)) * 0.1 }
    case 'shake':
      return { ...NEUTRAL, x: index === a.frames - 1 ? 0 : (index % 2 === 0 ? 1 : -1) * size * 0.02 }
    case 'textPop': {
      // 前半で文字が飛び出し、少し大きくなってから元のサイズに戻る
      const p = Math.min(1, t / 0.6)
      const c = 1.70158
      const ease = 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2)
      return { ...NEUTRAL, textScale: Math.max(0, ease) }
    }
    case 'flipbook': {
      const n = a.flipbookSources.length + 1
      // 最後のフレームが基本画像（0 番）になるようにずらす
      const shift = (n - (a.frames % n)) % n
      return { ...NEUTRAL, sourceIndex: (index + 1 + shift) % n }
    }
  }
}
