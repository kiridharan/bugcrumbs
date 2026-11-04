import type { Entry } from '@bugcrumbs/core'

/** Entries the widget counts as problems: errors, failed requests and queries, console errors. */
export const isFailure = (entry: Entry): boolean =>
  entry.kind === 'error' ||
  (entry.kind === 'network' && entry.failed) ||
  (entry.kind === 'console' && entry.level === 'error') ||
  (entry.kind === 'state' && entry.status === 'error')
