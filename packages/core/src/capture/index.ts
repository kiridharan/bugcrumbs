import { getBugcrumbs, type BugcrumbsInstance } from '../bugcrumbs'
import { isEnabled, type GuardOptions } from '../guard'
import { safely, safelyWarn } from '../safe'
import { patchConsole } from './console'
import { listenForErrors } from './errors'
import { patchFetch } from './fetch'
import type { NetworkOptions } from './network-shared'
import { recordSteps } from './steps'
import { patchXhr } from './xhr'

export interface CaptureOptions extends GuardOptions, NetworkOptions {
  /** Each capture source can be turned off; all are on by default. */
  network?: boolean
  console?: boolean
  errors?: boolean
  steps?: boolean
}

declare const process: { env: Record<string, string | undefined> }

/** Bundlers replace `process.env.NODE_ENV` at build time; without one it throws and we assume dev. */
function isProductionBuild(): boolean {
  try {
    return process.env.NODE_ENV === 'production'
  } catch {
    return false
  }
}

let warnedProduction = false

const running = new WeakMap<BugcrumbsInstance, { count: number; stop: () => void }>()

/**
 * True while `startCapture()` is active for the instance, i.e. Bugcrumbs is enabled (FR-23).
 * Adapters and error hooks check this so they record nothing in production builds.
 */
export function isCapturing(instance: BugcrumbsInstance = getBugcrumbs()): boolean {
  return running.has(instance)
}

/**
 * Starts background capture when enabled (FR-23) and returns a function that stops it.
 * Safe to call more than once: capture runs until every caller has stopped, and the
 * options from the first call win. Call it before rendering to catch the earliest requests.
 */
export function startCapture(options: CaptureOptions = {}, instance: BugcrumbsInstance = getBugcrumbs()): () => void {
  if (!isEnabled(options)) return () => {}

  let session = running.get(instance)
  if (!session) {
    if (isProductionBuild() && !warnedProduction) {
      warnedProduction = true
      // Uses the console captured at load time, so this warning isn't itself recorded.
      safelyWarn(
        '[bugcrumbs] Capture is enabled in a production build. That is expected on QA/staging builds; ' +
          'if this is a build real users get, unset the Bugcrumbs flag.',
      )
    }
    const stops: Array<() => void> = []
    const start = (enabled: boolean | undefined, install: () => () => void) => {
      if (enabled === false) return
      const stop = safely(install)
      if (stop) stops.push(stop)
    }
    start(options.network, () => patchFetch(instance, options))
    start(options.network, () => patchXhr(instance, options))
    start(options.console, () => patchConsole(instance))
    start(options.errors, () => listenForErrors(instance))
    start(options.steps, () => recordSteps(instance))
    session = { count: 0, stop: () => stops.forEach((stop) => safely(stop)) }
    running.set(instance, session)
  }

  const current = session
  current.count++
  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    if (--current.count === 0) {
      running.delete(instance)
      current.stop()
    }
  }
}
