export interface GuardOptions {
  /** Explicit switch, usually wired to an env flag such as `VITE_BUGCRUMBS`. */
  enabled?: boolean | string
  /** Hostnames where Bugcrumbs may run even without `enabled`, e.g. `staging.example.com`. */
  allowedHosts?: string[]
}

/** Bugcrumbs is off unless explicitly enabled or on an allowed host (FR-23). */
export function isEnabled(options: GuardOptions = {}): boolean {
  const { enabled, allowedHosts = [] } = options
  if (enabled === true || enabled === 'true') return true
  if (typeof location === 'undefined') return false
  return allowedHosts.includes(location.hostname)
}
