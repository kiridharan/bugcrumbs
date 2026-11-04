import type { Report } from '@bugcrumbs/core'

export interface SavedReport {
  id: string
  savedAt: number
  report: Report
}

export interface SavedReportStore {
  /** Oldest first. */
  list(): Promise<SavedReport[]>
  add(report: Report): Promise<SavedReport>
  remove(id: string): Promise<void>
  clear(): Promise<void>
  /** False when IndexedDB is unavailable (e.g. some private modes): reports are lost on reload. */
  readonly persistent: boolean
}

/** Saved reports can hold screenshots of a few hundred KB each; keep the total bounded. */
export const MAX_SAVED_REPORTS = 50

const DB_NAME = 'bugcrumbs'
const STORE = 'reports'

const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

function full(): Error {
  return new Error(`you have ${MAX_SAVED_REPORTS} saved bugs; export and delete some first`)
}

/** In-memory fallback; also used when IndexedDB turns out to be unusable at runtime. */
export function memoryStore(): SavedReportStore {
  let items: SavedReport[] = []
  return {
    persistent: false,
    list: async () => items.slice(),
    async add(report) {
      if (items.length >= MAX_SAVED_REPORTS) throw full()
      const saved = { id: newId(), savedAt: Date.now(), report }
      items = [...items, saved]
      return saved
    },
    async remove(id) {
      items = items.filter((item) => item.id !== id)
    },
    async clear() {
      items = []
    },
  }
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function indexedDbStore(factory: IDBFactory): SavedReportStore {
  let db: Promise<IDBDatabase> | undefined
  const open = () =>
    (db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = factory.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
      let settled = false
      req.onsuccess = () => {
        const database = req.result
        // Let a newer Bugcrumbs version in another tab upgrade the database.
        database.onversionchange = () => database.close()
        if (settled) database.close()
        else (settled = true), resolve(database)
      }
      req.onerror = () => ((settled = true), reject(req.error))
      req.onblocked = () => ((settled = true), reject(new Error('saved bugs are locked by another tab')))
    }).catch((error: unknown) => {
      db = undefined
      throw error
    }))
  const store = async (mode: IDBTransactionMode) => (await open()).transaction(STORE, mode).objectStore(STORE)

  return {
    persistent: true,
    async list() {
      const items = await request((await store('readonly')).getAll() as IDBRequest<SavedReport[]>)
      return items.sort((a, b) => a.savedAt - b.savedAt)
    },
    async add(report) {
      const objects = await store('readwrite')
      if ((await request(objects.count())) >= MAX_SAVED_REPORTS) throw full()
      const saved = { id: newId(), savedAt: Date.now(), report }
      try {
        await request(objects.add(saved))
      } catch (error) {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') throw new Error('browser storage is full; export and delete some saved bugs')
        throw error
      }
      return saved
    },
    async remove(id) {
      await request((await store('readwrite')).delete(id))
    },
    async clear() {
      await request((await store('readwrite')).clear())
    },
  }
}

/**
 * Reports saved by the tester, kept in this browser only (FR-16 for finished reports). Reports are
 * redacted before they are created, so nothing raw is written to disk.
 */
export function openSavedReports(): SavedReportStore {
  try {
    if (typeof indexedDB !== 'undefined' && indexedDB) return indexedDbStore(indexedDB)
  } catch {
    // Accessing indexedDB can throw when storage is blocked.
  }
  return memoryStore()
}
