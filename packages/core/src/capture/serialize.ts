export interface SerializeOptions {
  maxDepth?: number
  /** Longer strings are truncated. */
  maxString?: number
  /** Max keys per object or items per array. */
  maxKeys?: number
  /** Max values visited in total, so one huge payload can't fill memory. */
  maxNodes?: number
  /** Max characters of string content in total, across the whole value. */
  maxChars?: number
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}… [${text.length - max} more chars]` : text
}

/** Short, stable description of a DOM element, e.g. `button#save.primary`. */
export function describeElement(element: Element): string {
  let out = element.tagName.toLowerCase()
  if (element.id) out += `#${element.id}`
  const classes = typeof element.className === 'string' ? element.className.trim().split(/\s+/).filter(Boolean) : []
  if (classes.length) out += `.${classes.slice(0, 2).join('.')}`
  return out
}

/**
 * Converts any value into plain JSON-safe data at capture time, so the buffer never holds
 * live objects (DOM nodes, class instances) and never grows without bound.
 */
export function toSerializable(value: unknown, options: SerializeOptions = {}): unknown {
  const { maxDepth = 10, maxString = 2000, maxKeys = 100 } = options
  let budget = options.maxNodes ?? 2000
  let chars = options.maxChars ?? 65_536
  const ancestors = new Set<object>()

  const walk = (input: unknown, depth: number): unknown => {
    if (--budget < 0) return '[truncated]'
    switch (typeof input) {
      case 'string': {
        if (chars <= 0) return '[truncated]'
        const text = truncate(input, Math.min(maxString, chars))
        chars -= text.length
        return text
      }
      case 'number':
      case 'boolean':
      case 'undefined':
        return input
      case 'bigint':
        return `${input}n`
      case 'symbol':
        return input.toString()
      case 'function':
        return `[function ${input.name || 'anonymous'}]`
    }
    if (input === null) return null
    const object = input as object

    if (object instanceof Error) {
      return { name: object.name, message: object.message, stack: object.stack }
    }
    if (object instanceof Date) return Number.isNaN(object.getTime()) ? 'Invalid Date' : object.toISOString()
    if (object instanceof RegExp) return object.toString()
    if (typeof Element !== 'undefined' && object instanceof Element) return `<${describeElement(object)}>`
    if (typeof Node !== 'undefined' && object instanceof Node) return `[${object.nodeName}]`
    if (object instanceof ArrayBuffer) return `[binary ${object.byteLength} bytes]`
    if (ArrayBuffer.isView(object)) return `[binary ${object.byteLength} bytes]`

    if (ancestors.has(object)) return '[circular]'
    if (depth >= maxDepth) return '[truncated]'
    ancestors.add(object)
    try {
      if (object instanceof Map) {
        return walk(Object.fromEntries([...object.entries()].slice(0, maxKeys).map(([k, v]) => [String(k), v])), depth)
      }
      if (object instanceof Set) return walk([...object].slice(0, maxKeys), depth)
      if (Array.isArray(object)) {
        const items = object.slice(0, maxKeys).map((item) => walk(item, depth + 1))
        if (object.length > maxKeys) items.push(`[${object.length - maxKeys} more items]`)
        return items
      }
      const out: Record<string, unknown> = {}
      const keys = Object.keys(object)
      for (const key of keys.slice(0, maxKeys)) {
        try {
          out[key] = walk((object as Record<string, unknown>)[key], depth + 1)
        } catch {
          out[key] = '[unreadable]'
        }
      }
      if (keys.length > maxKeys) out['…'] = `[${keys.length - maxKeys} more keys]`
      return out
    } finally {
      ancestors.delete(object)
    }
  }

  return walk(value, 0)
}
