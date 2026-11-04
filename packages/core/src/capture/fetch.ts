import type { BugcrumbsInstance } from '../bugcrumbs'
import { safely } from '../safe'
import {
  headersToRecord,
  isReadableContentType,
  isTooLarge,
  readCapped,
  resolveUrl,
  shouldCapture,
  toNetworkEntry,
  type Exchange,
  type NetworkOptions,
} from './network-shared'
import { patchMethod } from './patch'

/** Marks a request made by Bugcrumbs itself (e.g. screenshot assets) so it isn't recorded. */
const UNTRACKED: unique symbol = Symbol.for('bugcrumbs.untracked')

/** Returns `init` tagged so Bugcrumbs' own fetch capture skips the request. fetch ignores symbol keys. */
export function untracked<T extends RequestInit>(init: T): T {
  return { ...init, [UNTRACKED]: true }
}

const isUntracked = (init: RequestInit | undefined): boolean =>
  !!init && (init as Record<symbol, unknown>)[UNTRACKED] === true

type PendingRequest = Pick<Exchange, 'method' | 'url' | 'requestHeaders' | 'requestContentType'> & {
  /** A string/FormData/… body, or a promise for the text of a `Request` body. */
  body: unknown
}

/** A `Request` body is always a stream; read a copy only if it's text and not too big. */
function requestBody(request: Request | undefined, headers: Headers): unknown {
  if (!request?.body) return undefined
  const contentType = headers.get('content-type')
  if (!isReadableContentType(contentType)) return `[${contentType ?? 'binary'} body]`
  if (isTooLarge(headers.get('content-length'))) return '[body omitted: too large]'
  // Start reading now, so the tee'd copy doesn't buffer the whole upload until the response.
  return readCapped(request.clone().body)
}

function describeRequest(input: RequestInfo | URL, init: RequestInit | undefined, options: NetworkOptions): PendingRequest | undefined {
  const request = typeof Request !== 'undefined' && input instanceof Request ? input : undefined
  const url = resolveUrl(typeof input === 'string' ? input : input instanceof URL ? input.href : (request?.url ?? String(input)))
  // Checked before anything else, so blocked requests cost (almost) nothing.
  if (!shouldCapture(url, options)) return undefined
  const headers = new Headers(init?.headers ?? request?.headers)
  return {
    method: init?.method ?? request?.method ?? 'GET',
    url,
    requestHeaders: headersToRecord(headers),
    requestContentType: headers.get('content-type') ?? undefined,
    body: init?.body ?? requestBody(request, headers),
  }
}

/** Reads a copy of the response body, or describes it when it shouldn't be read. */
function readResponseBody(response: Response): Promise<unknown> | unknown {
  if (!response.body || response.bodyUsed) return undefined
  const contentType = response.headers.get('content-type')
  if (!isReadableContentType(contentType)) return `[${contentType ?? 'binary'} body]`
  if (isTooLarge(response.headers.get('content-length'))) return '[body omitted: too large]'
  // Clone synchronously, before the app has a chance to consume the body.
  return readCapped(response.clone().body)
}

/** Records every `fetch` call (FR-01). The app always gets the original promise back. */
export function patchFetch(api: BugcrumbsInstance, options: NetworkOptions): () => void {
  if (typeof globalThis.fetch !== 'function') return () => {}

  return patchMethod(globalThis, 'fetch', (original) =>
    function (this: unknown, ...args: Parameters<typeof fetch>): Promise<Response> {
      if (isUntracked(args[1])) return original.apply(globalThis, args)
      const start = performance.now()
      const startTime = Date.now()
      const pending = safely(() => describeRequest(args[0], args[1], options))
      const result = original.apply(globalThis, args)
      // A mock or polyfill may not return a real promise; leave such calls alone.
      if (!pending || typeof (result as Partial<Promise<Response>> | undefined)?.then !== 'function') return result

      const record = async (status: number, response?: Response, error?: string) => {
        const durationMs = performance.now() - start
        const [requestBody, responseBody] = await Promise.all([pending.body, response && readResponseBody(response)])
        api.push(
          toNetworkEntry(
            {
              ...pending,
              startTime,
              durationMs,
              status,
              requestBody,
              responseHeaders: headersToRecord(response?.headers),
              responseBody,
              responseContentType: response?.headers.get('content-type') ?? undefined,
              error,
            },
            options,
            api.redactOptions.keys,
          ),
        )
      }

      // A separate branch: the app still receives (and must handle) the original promise.
      safely(() =>
        result.then(
          (response) => safely(() => record(response.status, response).catch(() => {})),
          (error: unknown) => safely(() => record(0, undefined, error instanceof Error ? error.message : String(error)).catch(() => {})),
        ),
      )
      return result
    },
  )
}
