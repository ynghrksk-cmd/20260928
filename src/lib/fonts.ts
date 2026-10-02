import { FONTS } from './presets'
import type { TextSettings } from './types'

/** Canvas の font 指定文字列（太さ・サイズ・書体） */
export function fontString(font: string, size: number) {
  const weight = FONTS.find((f) => f.value === font)?.weight ?? 400
  return `${weight} ${size}px ${font}, sans-serif`
}

/**
 * Web フォントは使われる文字ごとに分割読み込みされるため、
 * 描画する前にその文字を含むフォントを読み込んでおく。
 */
export async function ensureFonts(texts: Pick<TextSettings, 'font' | 'size' | 'content'>[]) {
  if (!('fonts' in document)) return
  const jobs = texts
    .filter((t) => t.content.trim())
    .map((t) => document.fonts.load(fontString(t.font, t.size), t.content).catch(() => []))
  await Promise.all(jobs)
}
