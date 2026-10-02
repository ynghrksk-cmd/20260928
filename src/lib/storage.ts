// 作業内容をブラウザの IndexedDB に保存・復元する（外部には送信しない）
import { canvasToBlob, imageToCanvas } from './render'
import type { Mode } from './specs'
import type { BackgroundSettings, ModeSet, SourceImage, StickerItem } from './types'

const DB_NAME = 'line-sticker-maker'
const STORE = 'project'
const KEY = 'current'
const VERSION = 1

export interface Project {
  mode: Mode
  count: number
  sources: SourceImage[]
  items: StickerItem[]
  selectedId: string | null
  mainId: string | null
  /** いま表示していないモードの作業内容 */
  stash?: Partial<Record<Mode, ModeSet>>
}

interface StoredSource {
  id: string
  name: string
  background: BackgroundSettings
  png: Blob
}

interface StoredProject extends Omit<Project, 'sources'> {
  version: number
  sources: StoredSource[]
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = fn(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(req.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

// 素材画像は作成後に変わらないので、PNG 化した結果を使い回す
const pngCache = new WeakMap<HTMLCanvasElement, Promise<Blob>>()
const toPng = (canvas: HTMLCanvasElement) => {
  let p = pngCache.get(canvas)
  if (!p) {
    p = canvasToBlob(canvas)
    pngCache.set(canvas, p)
  }
  return p
}

export async function saveProject(project: Project): Promise<void> {
  const sources = await Promise.all(
    project.sources.map(async (s) => ({ id: s.id, name: s.name, background: s.background, png: await toPng(s.canvas) })),
  )
  const stored: StoredProject = { ...project, version: VERSION, sources }
  await run('readwrite', (store) => store.put(stored, KEY))
}

export async function loadProject(): Promise<Project | null> {
  const stored = await run<StoredProject | undefined>('readonly', (store) => store.get(KEY))
  if (!stored || stored.version !== VERSION) return null
  const sources = await Promise.all(
    stored.sources.map(async (s) => {
      const bitmap = await createImageBitmap(s.png)
      const canvas = imageToCanvas(bitmap, Math.max(bitmap.width, bitmap.height))
      bitmap.close()
      pngCache.set(canvas, Promise.resolve(s.png))
      return { id: s.id, name: s.name, background: s.background, canvas }
    }),
  )
  return { ...stored, sources }
}

export async function clearProject(): Promise<void> {
  await run('readwrite', (store) => store.delete(KEY))
}
