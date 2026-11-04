/**
 * Runs SDK code so that a failure can never reach the host app.
 * Errors are reported through the original console method captured at load time.
 */
const originalWarn = typeof console !== 'undefined' ? console.warn.bind(console) : () => {}

/** Logs through the console as it was before any patching. */
export function safelyWarn(...args: unknown[]): void {
  try {
    originalWarn(...args)
  } catch {
    // Never throw into the host.
  }
}

export function safely<T>(fn: () => T, fallback?: T): T | undefined {
  try {
    return fn()
  } catch (error) {
    try {
      originalWarn('[bugcrumbs] internal error', error)
    } catch {
      // Nothing left to do; never throw into the host.
    }
    return fallback
  }
}
