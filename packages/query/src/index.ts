import { getBugcrumbs, isCapturing, redact, safely, toSerializable, truncate, type BugcrumbsInstance } from '@bugcrumbs/core'
import type { QueryClient, QueryKey } from '@tanstack/query-core'

export interface TrackQueryClientOptions {
  instance?: BugcrumbsInstance
}

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** Bounded, redacted copy of a key or variables; keys can hold tokens and big filter objects. */
function snapshot(instance: BugcrumbsInstance, value: unknown): unknown {
  return redact(toSerializable(value, { maxString: 500, maxNodes: 200, maxChars: 4096 }), instance.redactOptions)
}

/** Short label from the already-redacted key, e.g. `query ["todos",{"page":2}]`. */
function label(kind: 'query' | 'mutation', key: unknown): string {
  return `${kind} ${truncate(JSON.stringify(key ?? '(no key)'), 120)}`
}

/**
 * Records failed queries and mutations with their key and state (FR-07).
 * Records nothing unless Bugcrumbs is enabled and capturing (FR-23), so it is safe to call
 * unconditionally next to `new QueryClient()`. Returns a function that stops tracking.
 */
export function trackQueryClient(queryClient: QueryClient, options: TrackQueryClientOptions = {}): () => void {
  const instance = options.instance ?? getBugcrumbs()

  const stopQueries = queryClient.getQueryCache().subscribe((event) => {
    safely(() => {
      if (event.type !== 'updated' || event.action.type !== 'error' || !isCapturing(instance)) return
      const { query } = event
      const queryKey: QueryKey = query.queryKey
      const key = snapshot(instance, queryKey)
      instance.push({
        kind: 'state',
        source: 'tanstack-query',
        label: label('query', key),
        status: 'error',
        error: describeError(query.state.error),
        data: {
          queryKey: key,
          failureCount: query.state.fetchFailureCount,
          fetchStatus: query.state.fetchStatus,
          // Whether stale data was still on screen when the refetch failed.
          hasData: query.state.data !== undefined,
          dataUpdatedAt: query.state.dataUpdatedAt || undefined,
          observers: query.getObserversCount(),
        },
      })
    })
  })

  const stopMutations = queryClient.getMutationCache().subscribe((event) => {
    safely(() => {
      if (event.type !== 'updated' || event.action.type !== 'error' || !isCapturing(instance)) return
      const { mutation } = event
      const key = snapshot(instance, mutation.options.mutationKey)
      instance.push({
        kind: 'state',
        source: 'tanstack-query',
        label: label('mutation', key),
        status: 'error',
        error: describeError(mutation.state.error),
        data: {
          mutationKey: key,
          variables: snapshot(instance, mutation.state.variables),
          failureCount: mutation.state.failureCount,
        },
      })
    })
  })

  return () => {
    stopQueries()
    stopMutations()
  }
}
