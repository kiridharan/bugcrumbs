import { redactUrl } from '../redact'
import type { NetworkEntry } from '../types'
import { toSerializable, truncate } from './serialize'

export type UrlPattern = string | RegExp

export interface NetworkOptions {
  /** Max characters kept per text body. Default 16,384. */
  maxBodyLength?: number
  /** Only record requests whose absolute URL matches one of these (FR-22). Strings match as substrings. */
  allowUrls?: UrlPattern[]
  /** Never record requests whose absolute URL matches one of these (FR-22). Wins over `allowUrls`. */
  blockUrls?: UrlPattern[]
}

function matches(url: string, pattern: UrlPattern): boolean {
  if (typeof pattern === 'string') return url.includes(pattern)
  pattern.lastIndex = 0
  return pattern.test(url)
}

/** Applies the URL allow and block lists (FR-22). */
export function shouldCapture(url: string, options: NetworkOptions): boolean {
  if (options.blockUrls?.some((pattern) => matches(url, pattern))) return false
  return !options.allowUrls?.length || options.allowUrls.some((pattern) => matches(url, pattern))
}

/** What an interceptor observed, before bodies are normalised. */
export interface Exchange {
  method: string
  url: string
  startTime: number
  durationMs: number
  status: number
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
  requestBody?: unknown
  requestContentType?: string
  responseBody?: unknown
  responseContentType?: string
  error?: string
}

const DEFAULT_MAX_BODY = 16_384
/** Bodies larger than this are neither read past this point nor parsed. */
export const MAX_PARSE_LENGTH = 1_000_000
/** Give up waiting for a response body (long polling, slow streams) after this long. */
export const BODY_TIMEOUT_MS = 10_000

export function isReadableContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return true
  return (
    !/event-stream|ndjson|stream\+json|json-seq/i.test(contentType) &&
    /json|text\/|xml|x-www-form-urlencoded|graphql|javascript/i.test(contentType)
  )
}

export function headersToRecord(headers: Headers | undefined): Record<string, string> | undefined {
  if (!headers) return undefined
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value
  })
  return out
}

/** Parses "Name: value" lines from `getAllResponseHeaders()`. */
export function parseRawHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const index = line.indexOf(':')
    if (index > 0) out[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim()
  }
  return out
}

export function resolveUrl(url: string): string {
  try {
    return new URL(url, location.href).href
  } catch {
    return url
  }
}

/** True when a declared `content-length` already rules out reading the body. */
export function isTooLarge(contentLength: string | null | undefined): boolean {
  return Number(contentLength) > MAX_PARSE_LENGTH
}

/**
 * Reads a (cloned) body as text, then cancels our copy so a tee'd stream never keeps the
 * connection open or buffers without bound. Stops at MAX_PARSE_LENGTH or after BODY_TIMEOUT_MS,
 * returning whatever was read; over-long text is later replaced by a size marker in parseText.
 */
export async function readCapped(stream: ReadableStream<Uint8Array> | null | undefined): Promise<string | undefined> {
  if (!stream) return undefined
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let text = ''
  const timer = setTimeout(() => reader.cancel().catch(() => {}), BODY_TIMEOUT_MS)
  try {
    while (text.length <= MAX_PARSE_LENGTH) {
      const { done, value } = await reader.read()
      if (done) return text + decoder.decode()
      text += decoder.decode(value, { stream: true })
    }
    return text
  } catch {
    return text || undefined
  } finally {
    clearTimeout(timer)
    reader.cancel().catch(() => {})
  }
}

function parseText(text: string, contentType: string | undefined, max: number): unknown {
  if (text.length > MAX_PARSE_LENGTH) return `[body omitted: over ${MAX_PARSE_LENGTH} chars]`
  if (/json|graphql/i.test(contentType ?? '') || /^\s*[[{]/.test(text)) {
    try {
      return toSerializable(JSON.parse(text), { maxString: max, maxChars: max * 4 })
    } catch {
      // Not JSON after all; fall through to text.
    }
  }
  if (/x-www-form-urlencoded/i.test(contentType ?? '')) return Object.fromEntries(new URLSearchParams(text))
  return truncate(text, max)
}

/**
 * Turns a raw body (string, FormData, Blob, …) into plain data. Objects come back as objects
 * so that core's key-based redaction can reach fields like `password` inside them.
 */
export function normalizeBody(body: unknown, contentType: string | undefined, max: number): unknown {
  if (body === undefined || body === null || body === '') return undefined
  if (typeof body === 'string') return parseText(body, contentType, max)
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return Object.fromEntries(body)
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const out: Record<string, string> = {}
    body.forEach((value, key) => {
      out[key] = typeof value === 'string' ? truncate(value, max) : `[file ${value.name}, ${value.size} bytes]`
    })
    return out
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) return `[blob ${body.type || 'unknown type'}, ${body.size} bytes]`
  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) return '[stream]'
  if (typeof Document !== 'undefined' && body instanceof Document) return '[document]'
  return toSerializable(body, { maxString: max, maxChars: max * 4 })
}

export function toNetworkEntry(exchange: Exchange, options: NetworkOptions, keys: RegExp[] | undefined): Omit<NetworkEntry, 'id'> {
  const max = options.maxBodyLength ?? DEFAULT_MAX_BODY
  return {
    kind: 'network',
    time: exchange.startTime,
    method: exchange.method.toUpperCase(),
    url: redactUrl(exchange.url, keys),
    status: exchange.status,
    durationMs: Math.round(exchange.durationMs),
    requestHeaders: exchange.requestHeaders,
    responseHeaders: exchange.responseHeaders,
    requestBody: normalizeBody(exchange.requestBody, exchange.requestContentType, max),
    responseBody: normalizeBody(exchange.responseBody, exchange.responseContentType, max),
    failed: exchange.status === 0 || exchange.status >= 400,
    error: exchange.error,
  }
}
