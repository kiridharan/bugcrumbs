import type { BugcrumbsInstance } from '../bugcrumbs'
import { safely } from '../safe'
import { isReadableContentType, parseRawHeaders, resolveUrl, shouldCapture, toNetworkEntry, type NetworkOptions } from './network-shared'
import { patchMethod } from './patch'

interface XhrState {
  method: string
  url: string
  requestHeaders: Record<string, string>
  start: number
  startTime: number
  body?: unknown
  /** Set by the first send(); a repeated send() on the same request must not record twice. */
  sent?: boolean
}

function readResponse(xhr: XMLHttpRequest, contentType: string | undefined): unknown {
  if (xhr.responseType === '' || xhr.responseType === 'text') {
    return isReadableContentType(contentType) ? xhr.responseText : `[${contentType} body]`
  }
  if (xhr.responseType === 'json') return xhr.response
  return xhr.response ? `[${xhr.responseType} body]` : undefined
}

/** Records every XMLHttpRequest (FR-01), including those made by axios. */
export function patchXhr(api: BugcrumbsInstance, options: NetworkOptions): () => void {
  if (typeof XMLHttpRequest === 'undefined') return () => {}
  const proto = XMLHttpRequest.prototype
  const states = new WeakMap<XMLHttpRequest, XhrState>()

  const finish = (xhr: XMLHttpRequest, state: XhrState, error?: string) => {
    // open() again on an in-flight request starts a new one; drop the stale request's event.
    if (states.get(xhr) !== state) return
    const headers = parseRawHeaders(xhr.getAllResponseHeaders())
    const contentType = headers['content-type']
    api.push(
      toNetworkEntry(
        {
          method: state.method,
          url: state.url,
          startTime: state.startTime,
          durationMs: performance.now() - state.start,
          status: xhr.status,
          requestHeaders: state.requestHeaders,
          requestBody: state.body,
          requestContentType: state.requestHeaders['content-type'],
          responseHeaders: headers,
          responseBody: readResponse(xhr, contentType),
          responseContentType: contentType,
          error: xhr.status === 0 ? (error ?? 'Network error') : undefined,
        },
        options,
        api.redactOptions.keys,
      ),
    )
  }

  const restoreOpen = patchMethod(proto, 'open', (original) =>
    function (this: XMLHttpRequest, ...args: unknown[]) {
      safely(() => {
        const url = resolveUrl(String(args[1]))
        if (!shouldCapture(url, options)) {
          states.delete(this)
          return
        }
        states.set(this, { method: String(args[0]), url, requestHeaders: {}, start: 0, startTime: 0 })
      })
      // Pass the exact argument list: open(m, u) and open(m, u, undefined) behave differently.
      return (original as (...a: unknown[]) => void).apply(this, args)
    } as XMLHttpRequest['open'],
  )

  const restoreHeader = patchMethod(proto, 'setRequestHeader', (original) =>
    function (this: XMLHttpRequest, name: string, value: string) {
      safely(() => {
        const state = states.get(this)
        if (state) state.requestHeaders[name.toLowerCase()] = value
      })
      return original.call(this, name, value)
    },
  )

  const restoreSend = patchMethod(proto, 'send', (original) =>
    function (this: XMLHttpRequest, ...args: [body?: Document | XMLHttpRequestBodyInit | null]) {
      safely(() => {
        const state = states.get(this)
        if (!state || state.sent) return
        state.sent = true
        state.start = performance.now()
        state.startTime = Date.now()
        state.body = args[0]
        let error: string | undefined
        this.addEventListener('abort', () => (error = 'Aborted'), { once: true })
        this.addEventListener('timeout', () => (error = 'Timed out'), { once: true })
        this.addEventListener('loadend', () => safely(() => finish(this, state, error)), { once: true })
      })
      return original.apply(this, args)
    },
  )

  return () => {
    restoreOpen()
    restoreHeader()
    restoreSend()
  }
}
