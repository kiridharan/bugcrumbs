export const REDACTED = '[redacted]'

/** Key patterns redacted by default in headers, bodies and inputs (FR-21). */
export const DEFAULT_REDACT_KEYS: RegExp[] = [
  /pass(word|wd)?/i,
  /secret/i,
  /token/i,
  /^authorization$/i,
  /^(set-)?cookie$/i,
  /api[-_]?key/i,
  /^x-api-key$/i,
  /(^|[-_])otp/i,
  // Unanchored so `card[number]`, `creditCardNumber`, `cardCvc` and `cvv2` all match.
  /(card|cc).?(number|num|no)/i,
  /cvc|cvv|csc|security.?code/i,
  /session/i,
]

export interface RedactOptions {
  keys?: RegExp[]
  /** Maximum depth walked; deeper values are replaced. Guards against huge payloads. */
  maxDepth?: number
}

export function isSensitiveKey(key: string, keys: RegExp[] = DEFAULT_REDACT_KEYS): boolean {
  return keys.some((pattern) => pattern.test(key))
}

/**
 * Returns a deep copy of `value` with sensitive keys replaced.
 * Runs at capture time so raw values never enter the buffer.
 */
export function redact<T>(value: T, options: RedactOptions = {}): T {
  const keys = options.keys ?? DEFAULT_REDACT_KEYS
  const maxDepth = options.maxDepth ?? 12
  const seen = new WeakSet<object>()

  const walk = (input: unknown, depth: number): unknown => {
    if (typeof input === 'string') return redactString(input, keys)
    if (input === null || typeof input !== 'object') return input
    if (seen.has(input)) return '[circular]'
    if (depth >= maxDepth) return '[truncated]'
    seen.add(input)

    if (Array.isArray(input)) return input.map((item) => walk(item, depth + 1))

    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(input)) {
      out[key] = isSensitiveKey(key, keys) ? REDACTED : walk(child, depth + 1)
    }
    return out
  }

  return walk(value, 0) as T
}

function redactParams(params: string, keys: RegExp[]): string {
  const search = new URLSearchParams(params)
  let changed = false
  for (const key of new Set(search.keys())) {
    if (isSensitiveKey(key, keys)) {
      search.set(key, REDACTED)
      changed = true
    }
  }
  return changed ? search.toString() : params
}

/** Redacts sensitive query and hash parameters, e.g. `?token=…` or `#access_token=…`. Works on relative URLs. */
export function redactUrl(url: string, keys: RegExp[] = DEFAULT_REDACT_KEYS): string {
  const hashIndex = url.indexOf('#')
  const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex)
  const queryIndex = beforeHash.indexOf('?')
  let result = queryIndex === -1 ? beforeHash : `${beforeHash.slice(0, queryIndex + 1)}${redactParams(beforeHash.slice(queryIndex + 1), keys)}`
  if (hashIndex !== -1) {
    const hash = url.slice(hashIndex + 1)
    result += `#${hash.includes('=') ? redactParams(hash, keys) : hash}`
  }
  return result
}

// `key=value` at the start, after a URL delimiter or after whitespace/punctuation in free text.
const PARAM = /(^|[?&#\s;,(])([^=&\s#?;,()]+)=([^&\s#"'<>;,)]*)/g
const AUTH_SCHEME = /\b(Bearer|Basic)\s+[\w\-.~+/]+=*/gi
const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g

/**
 * Redacts secrets inside free text, where key-based redaction can't reach: sensitive `key=value`
 * pairs (URL parameters like `?access_token=…`, or `token=…` in a log line), `Bearer …`/`Basic …`
 * credentials and JWTs.
 */
export function redactString(text: string, keys: RegExp[] = DEFAULT_REDACT_KEYS): string {
  if (!/[=.]|bearer|basic/i.test(text)) return text
  return text
    .replace(PARAM, (match, prefix: string, key: string) =>
      isSensitiveKey(safeDecode(key), keys) ? `${prefix}${key}=${encodeURIComponent(REDACTED)}` : match,
    )
    .replace(AUTH_SCHEME, (_, scheme: string) => `${scheme} ${REDACTED}`)
    .replace(JWT, REDACTED)
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}
