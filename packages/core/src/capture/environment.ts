import { redact, redactUrl, type RedactOptions } from '../redact'
import type { EnvironmentInfo } from '../types'

export interface EnvironmentOptions {
  appVersion?: string
  /** Extra fields for the report, e.g. build id or feature flags. Redacted like everything else. */
  metadata?: Record<string, unknown>
}

/** Device, browser, viewport and page details for a report (FR-06). */
export function collectEnvironment(options: EnvironmentOptions = {}, redactOptions: RedactOptions = {}): EnvironmentInfo {
  const hasWindow = typeof window !== 'undefined'
  return {
    url: hasWindow ? redactUrl(location.href, redactOptions.keys) : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    language: typeof navigator !== 'undefined' ? navigator.language : '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    viewport: hasWindow ? { width: window.innerWidth, height: window.innerHeight } : { width: 0, height: 0 },
    screen: hasWindow
      ? { width: window.screen.width, height: window.screen.height, pixelRatio: window.devicePixelRatio || 1 }
      : { width: 0, height: 0, pixelRatio: 1 },
    appVersion: options.appVersion,
    metadata: options.metadata ? redact(options.metadata, redactOptions) : undefined,
  }
}
