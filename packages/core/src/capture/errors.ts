import type { BugcrumbsInstance } from '../bugcrumbs'
import { redactUrl } from '../redact'
import { safely } from '../safe'
import { describeElement, toSerializable } from './serialize'

function describeReason(reason: unknown): { message: string; stack?: string } {
  if (reason instanceof Error) return { message: reason.message || reason.name, stack: reason.stack }
  const serialised = toSerializable(reason)
  if (serialised === undefined) return { message: String(reason) }
  return { message: typeof serialised === 'string' ? serialised : JSON.stringify(serialised) }
}

/**
 * Records uncaught errors, unhandled promise rejections and failed resource loads (FR-03).
 * Uses listeners only — nothing is patched, and default browser reporting is untouched.
 */
export function listenForErrors(api: BugcrumbsInstance): () => void {
  if (typeof window === 'undefined') return () => {}

  const onError = (event: Event) =>
    safely(() => {
      const target = event.target
      // Resource errors don't bubble, so they only reach window in the capture phase.
      if (typeof Element !== 'undefined' && target instanceof Element) {
        const url = redactUrl(target.getAttribute('src') ?? target.getAttribute('href') ?? '', api.redactOptions.keys)
        api.push({ kind: 'error', source: 'resource', message: `Failed to load <${describeElement(target)}> ${url}`.trim() })
        return
      }
      const { message, error } = event as ErrorEvent
      const reason = error === undefined || error === null ? undefined : describeReason(error)
      api.push({ kind: 'error', source: 'uncaught', message: message || reason?.message || 'Unknown error', stack: reason?.stack })
    })

  const onRejection = (event: Event) =>
    safely(() => {
      const { message, stack } = describeReason((event as Event & { reason?: unknown }).reason)
      api.push({ kind: 'error', source: 'unhandledrejection', message, stack })
    })

  window.addEventListener('error', onError, true)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError, true)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}
