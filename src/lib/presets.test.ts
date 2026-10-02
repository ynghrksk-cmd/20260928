import { describe, expect, it } from 'vitest'
import { generateSet } from './presets'

describe('generateSet', () => {
  it('画像とセリフを順番に組み合わせて指定枚数を作る', () => {
    const set = generateSet('stamp', 8, ['a', 'b'], ['OK', 'NO', 'はい'], false)
    expect(set).toHaveLength(8)
    expect(set.map((i) => i.sourceId)).toEqual(['a', 'b', 'a', 'b', 'a', 'b', 'a', 'b'])
    expect(set.map((i) => i.text.content).slice(0, 4)).toEqual(['OK', 'NO', 'はい', 'OK'])
    expect(new Set(set.map((i) => i.id)).size).toBe(8)
  })
  it('文字なしなら画像は等倍のまま', () => {
    const set = generateSet('emoji', 8, ['a'], [], false)
    expect(set.every((i) => i.text.content === '' && i.transform.scale === 1)).toBe(true)
  })
})
