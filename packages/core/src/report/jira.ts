import type { Report } from '../types'
import { describeEntry, stringify, summarize } from './create'

/**
 * Jira wiki markup for free text. Captured text can come from the app's servers, so markup
 * characters are escaped: it must not become links, mentions, images, macros or table cells.
 */
function text(value: string): string {
  return value.replace(/[\\*_\-+^~?{}[\]|!#]/g, '\\$&')
}

const line = (value: string) => text(value.replace(/\s+/g, ' ').trim())

/** A {noformat} block shows text verbatim; only its own closing tag could break out of it. */
function block(value: string): string {
  return `{noformat}\n${value.replace(/\{(\s*noformat)/gi, '{ $1')}\n{noformat}`
}

/** Jira priority names for each severity, as used by Jira's default priority scheme. */
export const JIRA_PRIORITY: Record<NonNullable<Report['form']['severity']>, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Highest',
}

/**
 * Issue description in Jira wiki markup, for pasting into Jira or a CSV import. The title is the
 * issue summary, so it is not repeated here. Bodies are trimmed to keep within Jira's field limit.
 */
export function toJiraMarkup(report: Report): string {
  const { form } = report
  const summary = summarize(report)
  const out: string[] = []
  const add = (heading: string, ...body: string[]) => out.push(`h3. ${heading}`, ...body, '')

  if (form.description.trim()) add('What happened', text(form.description.trim()))
  if (form.expected?.trim()) add('Expected result', text(form.expected.trim()))
  if (form.extra?.length) add('Details', ...form.extra.map((field) => `* *${line(field.label)}:* ${line(field.value)}`))
  add('Steps to reproduce', ...(summary.steps.length ? summary.steps.map((step) => `# ${line(step.label)}`) : ['_No steps recorded._']))

  if (summary.failedRequests.length) {
    add(
      'Failed requests',
      ...summary.failedRequests.map((request) =>
        [`* ${line(describeEntry(request))}`, request.responseBody !== undefined ? block(stringify(request.responseBody, 1500)) : ''].filter(Boolean).join('\n'),
      ),
    )
  }
  if (summary.errors.length) {
    add('Errors', ...summary.errors.map((error) => [`* ${line(describeEntry(error))}`, error.stack ? block(stringify(error.stack, 1500)) : ''].filter(Boolean).join('\n')))
  }
  if (summary.failedState.length) add('Failed app state', ...summary.failedState.map((state) => `* ${line(describeEntry(state))}`))
  if (summary.consoleProblems.length) add('Console warnings and errors', block(summary.consoleProblems.map((entry) => stringify(describeEntry(entry), 500)).join('\n')))

  const env = report.environment
  add(
    'Environment',
    `* *URL:* ${line(env.url)}`,
    `* *Browser:* ${line(env.userAgent)}`,
    `* *Viewport:* ${env.viewport.width}x${env.viewport.height}`,
    ...(env.appVersion ? [`* *App version:* ${line(env.appVersion)}`] : []),
  )
  if (report.screenshot) out.push('_A screenshot is attached to the HTML report._', '')
  out.push(`_Captured by Bugcrumbs · ${report.createdAt}_`)
  return out.join('\n')
}
