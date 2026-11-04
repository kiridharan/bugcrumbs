type Callable = (this: unknown, ...args: unknown[]) => unknown

/**
 * Replaces `target[key]` with a wrapper built from the current value, so we chain onto
 * whatever was there before (Sentry, MSW, …). Returns an uninstall function.
 *
 * On uninstall we only restore the original if nobody patched on top of us; otherwise our
 * wrapper stays in place but becomes a plain passthrough, so their patch keeps working.
 * If the property can't be written (frozen object, SES lockdown) nothing is patched.
 */
export function patchMethod<T extends object, K extends keyof T>(
  target: T,
  key: K,
  wrap: (original: T[K]) => T[K],
): () => void {
  const original = target[key]
  // e.g. `history.pushState` lives on History.prototype; restoring it as an own property
  // would shadow anyone who patches the prototype later, so we delete instead.
  const wasOwn = Object.prototype.hasOwnProperty.call(target, key)
  const hooked = wrap(original) as unknown as Callable
  let active = true
  const patched = function (this: unknown, ...args: unknown[]): unknown {
    return (active ? hooked : (original as unknown as Callable)).apply(this, args)
  }

  try {
    target[key] = patched as unknown as T[K]
  } catch {
    return () => {}
  }
  if (target[key] !== (patched as unknown)) return () => {}

  return () => {
    active = false
    if (target[key] !== (patched as unknown)) return
    try {
      if (wasOwn) target[key] = original
      else delete target[key]
    } catch {
      // Leave our wrapper in place; it is already a passthrough.
    }
  }
}
