import type { Report } from '../types'
import { describeEntry, summarize } from './create'
import { JIRA_PRIORITY, toJiraMarkup } from './jira'

/** Excel and Jira both cap a cell/field at 32,767 characters. */
const MAX_CELL = 32_000

/**
 * One CSV cell. Values can come from the app's servers, so a leading `=`, `+`, `-`, `@` (also after
 * whitespace, and their full-width forms), tab or line break is prefixed with `'`: spreadsheets would otherwise run it as a formula.
 */
function cell(value: string): string {
  let safe = value.length > MAX_CELL ? `${value.slice(0, MAX_CELL)}\n… [truncated]` : value
  if (/^[\s\uFEFF]*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]|^[\t\r\n]/.test(safe)) safe = `'${safe}`
  return `"${safe.replace(/"/g, '""')}"`
}

const COLUMNS = ['Summary', 'Issue Type', 'Priority', 'Description', 'Severity', 'Reported', 'Page URL', 'Steps', 'Failed requests', 'Errors', 'Screenshot'] as const

/**
 * Many reports as one CSV (FR-14): opens in Excel or Google Sheets, and the column names match
 * Jira's CSV importer (Summary, Issue Type, Priority, Description in Jira wiki markup).
 * Starts with a byte-order mark so Excel reads it as UTF-8.
 */
export function toCSV(reports: Report[]): string {
  const rows = reports.map((report) => {
    const summary = summarize(report)
    const values: Record<(typeof COLUMNS)[number], string> = {
      Summary: report.form.title,
      'Issue Type': 'Bug',
      Priority: report.form.severity ? JIRA_PRIORITY[report.form.severity] : '',
      Description: toJiraMarkup(report),
      Severity: report.form.severity ?? '',
      Reported: report.createdAt,
      'Page URL': report.environment.url,
      Steps: summary.steps.map((step, i) => `${i + 1}. ${step.label}`).join('\n'),
      'Failed requests': summary.failedRequests.map(describeEntry).join('\n'),
      Errors: summary.errors.map(describeEntry).join('\n'),
      Screenshot: report.screenshot ? 'In the HTML report' : '',
    }
    return COLUMNS.map((column) => cell(values[column])).join(',')
  })
  return `﻿${[COLUMNS.map(cell).join(','), ...rows].join('\r\n')}\r\n`
}
