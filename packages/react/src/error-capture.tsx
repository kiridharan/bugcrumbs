import { Component, type ErrorInfo, type ReactNode } from 'react'
import { getBugcrumbs, isCapturing, redact, safely, type BugcrumbsInstance, type EntryInput } from '@bugcrumbs/core'

/** Retry delays (ms) for errors reported before capture has started; ~4 s in total. */
const RETRY_DELAYS = [0, 50, 250, 1000, 3000]
const MAX_PENDING = 10
const pending = new Map<BugcrumbsInstance, EntryInput[]>()

/**
 * React reports errors from the first mount during commit, before <BugcrumbsDevtools />'s effect
 * has started capture. Hold a few (already redacted) briefly and record them once capture starts;
 * if it never does — e.g. in production (FR-23) — they are dropped, never stored.
 */
function holdUntilCapturing(instance: BugcrumbsInstance, entry: EntryInput) {
  let queue = pending.get(instance)
  if (!queue) {
    queue = []
    pending.set(instance, queue)
    retry(instance, 0)
  }
  if (queue.length < MAX_PENDING) queue.push(redact(entry, instance.redactOptions))
}

function retry(instance: BugcrumbsInstance, attempt: number) {
  setTimeout(
    () =>
      safely(() => {
        if (isCapturing(instance)) {
          for (const entry of pending.get(instance) ?? []) instance.push(entry)
          pending.delete(instance)
        } else if (attempt + 1 < RETRY_DELAYS.length) {
          retry(instance, attempt + 1)
        } else {
          pending.delete(instance)
        }
      }),
    RETRY_DELAYS[attempt],
  )
}

function pushReactError(instance: BugcrumbsInstance, error: unknown, componentStack?: string | null) {
  safely(() => {
    const err = error instanceof Error ? error : new Error(String(error))
    const entry: EntryInput = {
      kind: 'error',
      source: 'react',
      message: err.message,
      stack: err.stack,
      componentStack: componentStack ?? undefined,
      time: Date.now(),
    }
    if (isCapturing(instance)) instance.push(entry)
    else holdUntilCapturing(instance, entry)
  })
}

interface BoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  instance?: BugcrumbsInstance
}

/** Records render errors with their component stack (FR-04). */
export class BugcrumbsErrorBoundary extends Component<BoundaryProps, { hasError: boolean }> {
  state: { hasError: boolean } = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    pushReactError(this.props.instance ?? getBugcrumbs(), error, info.componentStack)
  }

  render(): ReactNode {
    return this.state.hasError ? (this.props.fallback ?? null) : this.props.children
  }
}

type RootErrorHandler = (error: unknown, info: { componentStack?: string }) => void

export interface RootErrorHandlers {
  onCaughtError?: RootErrorHandler
  onUncaughtError?: RootErrorHandler
  onRecoverableError?: RootErrorHandler
}

/**
 * React 19 root error hooks (FR-04). Spread into `createRoot(el, { ...bugcrumbsRootOptions() })`.
 * Pass your own handlers to keep existing behaviour; they run after capture.
 */
export function bugcrumbsRootOptions(
  handlers: RootErrorHandlers = {},
  instance: BugcrumbsInstance = getBugcrumbs(),
): Required<RootErrorHandlers> {
  const wrap =
    (handler?: RootErrorHandler): RootErrorHandler =>
    (error, info) => {
      pushReactError(instance, error, info.componentStack)
      handler?.(error, info)
    }
  return {
    onCaughtError: wrap(handlers.onCaughtError),
    onUncaughtError: wrap(handlers.onUncaughtError),
    onRecoverableError: wrap(handlers.onRecoverableError),
  }
}
