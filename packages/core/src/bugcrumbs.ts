import { collectEnvironment, type EnvironmentOptions } from './capture/environment'
import { RingBuffer } from './ring-buffer'
import { redact, type RedactOptions } from './redact'
import { safely } from './safe'
import type { Entry, EntryInput, EnvironmentInfo } from './types'

export interface BugcrumbsPlugin {
  name: string
  /** Called once when registered; returns a teardown function. */
  setup(api: BugcrumbsInstance): void | (() => void)
}

export interface BugcrumbsOptions extends EnvironmentOptions {
  /** Max entries kept in memory (FR-08). Default 1,000. */
  maxEntries?: number
  redact?: RedactOptions
}

export interface BugcrumbsInstance {
  push(entry: EntryInput): void
  /** Adds a manual repro step (FR-05). */
  mark(label: string): void
  /** Returns the same array until entries change, so it is safe as a `useSyncExternalStore` snapshot. */
  getEntries(): Entry[]
  /** Device, browser and page details at the time of the call (FR-06). */
  getEnvironment(): EnvironmentInfo
  /** Merges fields into the custom metadata attached to reports. */
  setMetadata(metadata: Record<string, unknown>): void
  /** Removes all entries, or only those with an id up to `upToId` (e.g. the ones a saved report holds). */
  clear(upToId?: number): void
  /** Listener runs in a microtask, never synchronously, so React render can't loop. */
  subscribe(listener: () => void): () => void
  use(plugin: BugcrumbsPlugin): () => void
  destroy(): void
  readonly redactOptions: RedactOptions
}

export function createBugcrumbs(options: BugcrumbsOptions = {}): BugcrumbsInstance {
  const buffer = new RingBuffer<Entry>(options.maxEntries ?? 1000)
  const listeners = new Set<() => void>()
  const teardowns = new Map<BugcrumbsPlugin, () => void>()
  const redactOptions = options.redact ?? {}
  let nextId = 1
  let metadata = options.metadata
  let snapshot: Entry[] | undefined
  let notifyScheduled = false

  const notify = () => {
    if (notifyScheduled) return
    notifyScheduled = true
    queueMicrotask(() => {
      notifyScheduled = false
      for (const listener of listeners) safely(listener)
    })
  }

  const instance: BugcrumbsInstance = {
    redactOptions,
    push(input) {
      safely(() => {
        // A caller-supplied time must be a valid date, or every export would fail to format it.
        const time = Number.isFinite(input.time) && Math.abs(input.time!) < 8.64e15 ? input.time! : Date.now()
        const entry = redact({ ...input, id: nextId++, time }, redactOptions) as Entry
        buffer.push(entry)
        snapshot = undefined
        notify()
      })
    },
    mark(label) {
      instance.push({ kind: 'step', action: 'mark', label })
    },
    getEntries: () => (snapshot ??= buffer.toArray()),
    getEnvironment: () => collectEnvironment({ appVersion: options.appVersion, metadata }, redactOptions),
    setMetadata(next) {
      metadata = { ...metadata, ...next }
    },
    clear(upToId) {
      if (upToId === undefined) buffer.clear()
      else buffer.remove((entry) => entry.id <= upToId)
      snapshot = undefined
      notify()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    use(plugin) {
      if (teardowns.has(plugin)) return teardowns.get(plugin)!
      const teardown = safely(() => plugin.setup(instance)) ?? (() => {})
      const remove = () => {
        if (!teardowns.delete(plugin)) return
        safely(teardown)
      }
      teardowns.set(plugin, remove)
      return remove
    },
    destroy() {
      for (const remove of [...teardowns.values()]) remove()
      listeners.clear()
      buffer.clear()
      snapshot = undefined
    },
  }

  return instance
}

let defaultInstance: BugcrumbsInstance | undefined

/** Shared instance used by `<BugcrumbsDevtools />` and adapters when none is passed. */
export function getBugcrumbs(): BugcrumbsInstance {
  defaultInstance ??= createBugcrumbs()
  return defaultInstance
}
