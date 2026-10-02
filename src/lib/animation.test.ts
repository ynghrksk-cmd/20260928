import { describe, expect, it } from 'vitest'
import { ANIMATION_PRESETS, defaultAnimation, frameDelay, frameState, normalizeAnimation } from './animation'

describe('normalizeAnimation', () => {
  it('フレーム数を 5〜20 に収める', () => {
    expect(normalizeAnimation({ ...defaultAnimation(), frames: 2 }).frames).toBe(5)
    expect(normalizeAnimation({ ...defaultAnimation(), frames: 30 }).frames).toBe(20)
  })
  it('再生時間 × ループ数が 4 秒を超えないようループ数を減らす', () => {
    const a = normalizeAnimation({ ...defaultAnimation(), duration: 1.5, loops: 4 })
    expect(a.loops).toBe(2)
    expect(a.duration * a.loops).toBeLessThanOrEqual(4)
    expect(normalizeAnimation({ ...defaultAnimation(), duration: 1, loops: 4 }).loops).toBe(4)
    expect(normalizeAnimation({ ...defaultAnimation(), duration: 6, loops: 3 })).toMatchObject({ duration: 4, loops: 1 })
  })
})

describe('frameDelay', () => {
  it('合計時間が指定秒数を超えない', () => {
    const a = { ...defaultAnimation(), frames: 12, duration: 1 }
    expect(frameDelay(a)).toBe(8)
    expect(frameDelay(a) * a.frames).toBeLessThanOrEqual(100)
  })
})

describe('frameState', () => {
  it('どの動きも最後のフレームは基本の姿勢', () => {
    for (const { value } of ANIMATION_PRESETS) {
      for (const frames of [5, 7, 12, 20]) {
        const a = { ...defaultAnimation(value), frames, flipbookSources: ['b', 'c'] }
        const s = frameState(a, frames - 1, 300)
        expect(s.x).toBeCloseTo(0)
        expect(s.y).toBeCloseTo(0)
        expect(s.rotation).toBeCloseTo(0)
        expect(s.scale).toBeCloseTo(1)
        expect(s.textScale).toBeCloseTo(1)
        expect(s.sourceIndex).toBe(0)
      }
    }
  })
  it('途中のフレームでは動いている', () => {
    const a = defaultAnimation('bounce')
    expect(frameState(a, 2, 300).y).toBeLessThan(0)
  })
  it('パラパラは画像を順番に切り替える', () => {
    const a = { ...defaultAnimation('flipbook'), frames: 6, flipbookSources: ['b', 'c'] }
    expect(Array.from({ length: 6 }, (_, i) => frameState(a, i, 300).sourceIndex)).toEqual([1, 2, 0, 1, 2, 0])
  })
})
