import type { BugcrumbsInstance } from '../bugcrumbs'
import { redactString } from '../redact'
import { REPORT_SCHEMA_VERSION, type Entry, type Report, type ReportForm } from '../types'

export interface CreateReportInput {
  form: ReportForm
  /** PNG data URL. */
  screenshot?: string
}

/** Snapshots the instance into a report (FR-13). Entries are already redacted at capture time. */
export function createReport(instance: BugcrumbsInstance, input: CreateReportInput): Report {
  const keys = instance.redactOptions.keys
  const { extra, ...form } = input.form
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    // Testers paste log lines into the form; catch tokens and credentials in them too.
    form: {
      ...form,
      title: redactString(form.title, keys),
      description: redactString(form.description, keys),
      expected: form.expected === undefined ? undefined : redactString(form.expected, keys),
      ...(extra?.length && { extra: extra.map((field) => ({ label: field.label, value: redactString(field.value, keys) })) }),
    },
    environment: instance.getEnvironment(),
    entries: instance.getEntries().slice(),
    screenshot: input.screenshot,
  }
}

export interface ReportSummary {
  steps: Extract<Entry, { kind: 'step' }>[]
  failedRequests: Extract<Entry, { kind: 'network' }>[]
  errors: Extract<Entry, { kind: 'error' }>[]
  consoleProblems: Extract<Entry, { kind: 'console' }>[]
  failedState: Extract<Entry, { kind: 'state' }>[]
}

/** The parts of a report a developer reads first; shared by every exporter. */
export function summarize(report: Report): ReportSummary {
  const summary: ReportSummary = { steps: [], failedRequests: [], errors: [], consoleProblems: [], failedState: [] }
  for (const entry of report.entries) {
    if (entry.kind === 'step') summary.steps.push(entry)
    else if (entry.kind === 'network' && entry.failed) summary.failedRequests.push(entry)
    else if (entry.kind === 'error') summary.errors.push(entry)
    else if (entry.kind === 'console' && (entry.level === 'error' || entry.level === 'warn')) summary.consoleProblems.push(entry)
    else if (entry.kind === 'state' && entry.status === 'error') summary.failedState.push(entry)
  }
  return summary
}

export function formatTime(time: number): string {
  const date = new Date(time)
  return Number.isNaN(date.getTime()) ? '--:--:--.---' : date.toISOString().slice(11, 23)
}

export function stringify(value: unknown, max = 4000): string {
  if (value === undefined) return ''
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return text.length > max ? `${text.slice(0, max)}\n… [${text.length - max} more chars]` : text
}

export function describeEntry(entry: Entry): string {
  switch (entry.kind) {
    case 'network':
      return `${entry.method} ${entry.url} → ${entry.status || entry.error || 'failed'} (${entry.durationMs} ms)`
    case 'console':
      return `console.${entry.level}: ${entry.args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ')}`
    case 'error':
      return `${entry.source} error: ${entry.message}`
    case 'step':
      return entry.label
    case 'state':
      return `${entry.source} ${entry.label}: ${entry.status}${entry.error ? ` — ${entry.error}` : ''}`
  }
}

/** One line naming the most recent problem, e.g. to suggest a report title. */
export function suggestTitle(entries: Entry[]): string | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]!
    if (entry.kind === 'network' && entry.failed) {
      let path = entry.url
      try {
        path = new URL(entry.url, 'http://x').pathname
      } catch {}
      return `${entry.method} ${path} fails (${entry.status || entry.error || 'network error'})`
    }
    if (entry.kind === 'error') return entry.message.split('\n')[0]!.slice(0, 100)
    if (entry.kind === 'state' && entry.status === 'error') return `${entry.label} fails`
  }
  return undefined
}

/** File-name-safe slug of the report title. */
export function reportFileName(report: Report, extension: string): string {
  const slug = report.form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'report'
  return `bugcrumbs-${slug}-${report.createdAt.slice(0, 19).replace(/[:T]/g, '-')}.${extension}`
}
