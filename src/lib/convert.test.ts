import { describe, expect, it } from 'vitest'
import { convertItem } from './convert'
import { defaultAnimation } from './animation'
import { newItem } from './presets'
import { SPECS } from './specs'

const stamp = SPECS.stamp
const emoji = SPECS.emoji

describe('convertItem', () => {
  const base = () => {
    const item = newItem('stamp', 'src', 'OK')
    item.transform = { scale: 0.8, x: 20, y: -10, rotation: 15, flipX: true }
    item.text = { ...item.text, x: 0.5, y: 0.8, size: 52, strokeWidth: 10 }
    item.outline = { enabled: true, width: 6, color: '#fff' }
    return item
  }

  it('内容の範囲が変換先のセーフエリアいっぱいに、中央へ来る', () => {
    // 内容が (85,10)〜(285,310)：幅200×高さ300 → 絵文字の 168px に合わせて k = 168/300
    const content = { x: 85, y: 10, width: 200, height: 300 }
    const out = convertItem(base(), stamp, emoji, { imageSize: { width: 1000, height: 1000 }, content, text: null }, true, 'new')
    const k = 168 / 300
    // 元の画像中心 (185+20, 160-10) は内容中心 (185,160) から (20,-10) ずれている
    expect(out.transform.x).toBeCloseTo(20 * k)
    expect(out.transform.y).toBeCloseTo(-10 * k)
    // 表示上の大きさの比が k になる（元: 300/1000*0.8 → 先: 168/1000*scale）
    expect((168 / 1000) * out.transform.scale).toBeCloseTo((300 / 1000) * 0.8 * k)
    expect(out.transform.rotation).toBe(15)
    expect(out.transform.flipX).toBe(true)
    expect(out.id).toBe('new')
  })

  it('文字の位置・大きさ・フチも同じ比率で縮める', () => {
    const content = { x: 10, y: 10, width: 350, height: 300 }
    const k = Math.min(168 / 350, 168 / 300)
    const out = convertItem(base(), stamp, emoji, { imageSize: null, content, text: { cx: 185, cy: 250, fontSize: 48 } }, true, 'n')
    expect(out.text.content).toBe('OK')
    expect(out.text.size).toBe(Math.round(48 * k))
    expect(out.text.strokeWidth).toBe(Math.round(10 * k))
    expect(out.text.x).toBeCloseTo(0.5)
    expect(out.text.y * 180).toBeCloseTo((250 - 160) * k + 90)
    expect(out.outline.width).toBe(Math.round(6 * k))
  })

  it('文字を消す指定なら文字は空に', () => {
    const out = convertItem(base(), stamp, emoji, { imageSize: null, content: null, text: null }, false, 'n')
    expect(out.text.content).toBe('')
  })

  it('アニメーションの設定は外す', () => {
    const item = { ...base(), animation: defaultAnimation() }
    const out = convertItem(item, SPECS.anim, emoji, { imageSize: null, content: null, text: null }, true, 'n')
    expect(out.animation).toBeUndefined()
  })
})
