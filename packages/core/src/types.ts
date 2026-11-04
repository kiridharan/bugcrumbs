export type EntryKind = 'network' | 'console' | 'error' | 'step' | 'state'

interface BaseEntry {
  id: number
  kind: EntryKind
  /** Milliseconds since epoch. */
  time: number
}

export interface NetworkEntry extends BaseEntry {
  kind: 'network'
  method: string
  url: string
  status: number
  durationMs: number
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
  requestBody?: unknown
  responseBody?: unknown
  /** True for HTTP status >= 400, network errors and aborts. */
  failed: boolean
  /** Network-level failure such as a CORS error or abort; `status` is 0. */
  error?: string
}

export interface ConsoleEntry extends BaseEntry {
  kind: 'console'
  level: 'log' | 'info' | 'warn' | 'error'
  args: unknown[]
  stack?: string
}

export interface ErrorEntry extends BaseEntry {
  kind: 'error'
  source: 'uncaught' | 'unhandledrejection' | 'resource' | 'react'
  message: string
  stack?: string
  componentStack?: string
}

export interface StepEntry extends BaseEntry {
  kind: 'step'
  action: 'click' | 'input' | 'navigate' | 'mark'
  label: string
}

export interface StateEntry extends BaseEntry {
  kind: 'state'
  /** Adapter that produced the entry, e.g. "tanstack-query". */
  source: string
  label: string
  status: string
  error?: string
  data?: unknown
}

export type Entry = NetworkEntry | ConsoleEntry | ErrorEntry | StepEntry | StateEntry

/** An entry before core assigns its id and timestamp. */
export type EntryInput = Entry extends infer E
  ? E extends Entry
    ? Omit<E, 'id' | 'time'> & { time?: number }
    : never
  : never

export interface EnvironmentInfo {
  url: string
  userAgent: string
  language: string
  timezone: string
  viewport: { width: number; height: number }
  screen: { width: number; height: number; pixelRatio: number }
  appVersion?: string
  metadata?: Record<string, unknown>
}

/** A tester-filled field the host app added to the report form, e.g. "Build number". */
export interface ReportField {
  label: string
  value: string
}

export interface ReportForm {
  title: string
  /** What happened. May be empty when the host app makes it optional. */
  description: string
  expected?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
  /** Extra fields configured by the host app, in display order. */
  extra?: ReportField[]
}

export const REPORT_SCHEMA_VERSION = 1

export interface Report {
  schemaVersion: typeof REPORT_SCHEMA_VERSION
  createdAt: string
  form: ReportForm
  environment: EnvironmentInfo
  entries: Entry[]
  /** PNG data URL, when a screenshot was taken. */
  screenshot?: string
}
