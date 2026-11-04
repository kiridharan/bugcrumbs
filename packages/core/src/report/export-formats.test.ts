import { describe, expect, it } from 'vitest'
import { createBugcrumbs } from '../bugcrumbs'
import { createReport, suggestTitle } from './create'
import { toCSV } from './csv'
import { toHTML } from './html'
import { toJiraMarkup } from './jira'
import { toMarkdown } from './markdown'

function report(title = 'Checkout fails', extra?: { label: string; value: string }[]) {
  const bc = createBugcrumbs()
  bc.push({ kind: 'step', action: 'click', label: 'Clicked [~admin] "Pay"' })
  bc.push({ kind: 'network', method: 'POST', url: 'http://x.test/api/orders', status: 500, durationMs: 5, failed: true, responseBody: '{noformat}[link|http://evil]' })
  return createReport(bc, { form: { title, description: 'It *broke*', severity: 'critical', extra } })
}

/** Minimal RFC 4180 parser, enough to read back what toCSV writes. */
function parseCSV(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]!
    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') (value += '"'), i++
      else if (char === '"') quoted = false
      else value += char
    } else if (char === '"') quoted = true
    else if (char === ',') row.push(value), (value = '')
    else if (char === '\r' && csv[i + 1] === '\n') row.push(value), rows.push(row), (row = []), (value = ''), i++
    else value += char
  }
  return rows
}

describe('toCSV (Jira import, Excel)', () => {
  it('writes one row per report with Jira importer columns, quoted', () => {
    const csv = toCSV([report('First, "quoted"'), report('Second\nline')])
    expect(csv.startsWith('﻿')).toBe(true)
    const [header, first, second] = parseCSV(csv.slice(1))
    expect(header!.slice(0, 4)).toEqual(['Summary', 'Issue Type', 'Priority', 'Description'])
    expect(first!.slice(0, 3)).toEqual(['First, "quoted"', 'Bug', 'Highest'])
    expect(second![0]).toBe('Second\nline')
    expect(first![header!.indexOf('Failed requests')]).toBe('POST http://x.test/api/orders → 500 (5 ms)')
  })

  it('neutralises spreadsheet formulas from captured or typed values', () => {
    for (const evil of ['=HYPERLINK("http://evil")', '+1+1', '-2+3', '@SUM(A1)', '\t=1', ' =1+1', '\n=1', '＝1+1']) {
      const [, row] = parseCSV(toCSV([report(evil)]).slice(1))
      expect(row![0]).toBe(`'${evil}`)
    }
  })
})

describe('toJiraMarkup', () => {
  it('escapes wiki markup in typed and captured text and keeps bodies inside noformat', () => {
    const markup = toJiraMarkup(report())
    expect(markup).toContain('It \\*broke\\*')
    expect(markup).toContain('# Clicked \\[\\~admin\\] "Pay"')
    expect(markup).toContain('{noformat}\n{ noformat}[link|http://evil]\n{noformat}')
    expect(markup.match(/\{noformat\}/g)).toHaveLength(2)
  })
})

describe('extra form fields', () => {
  it('are redacted and rendered in every format', () => {
    const r = report('Bug', [{ label: 'Build', value: '1.2.3' }, { label: 'Notes', value: 'password=hunter2' }])
    expect(r.form.extra![0]).toEqual({ label: 'Build', value: '1.2.3' })
    expect(r.form.extra![1]!.value).not.toContain('hunter2')
    expect(toMarkdown(r)).toContain('- **Build:** 1.2.3')
    expect(toHTML(r)).toContain('<th scope="row">Build</th><td>1.2.3</td>')
    expect(toJiraMarkup(r)).toContain('* *Build:* 1.2.3')
    for (const text of [toMarkdown(r), toHTML(r), toCSV([r])]) expect(text).not.toContain('hunter2')
  })

  it('omits an empty "What happened" section', () => {
    const r = createReport(createBugcrumbs(), { form: { title: 'T', description: ' ' } })
    expect(toMarkdown(r)).not.toContain('What happened')
    expect(toHTML(r)).not.toContain('What happened')
  })
})

describe('suggestTitle', () => {
  it('names the latest failure', () => {
    const bc = createBugcrumbs()
    expect(suggestTitle(bc.getEntries())).toBeUndefined()
    bc.push({ kind: 'network', method: 'GET', url: 'http://x.test/api/cart?id=1', status: 503, durationMs: 1, failed: true })
    expect(suggestTitle(bc.getEntries())).toBe('GET /api/cart fails (503)')
    bc.push({ kind: 'error', source: 'uncaught', message: 'boom\nmore' })
    expect(suggestTitle(bc.getEntries())).toBe('boom')
  })
})

describe('clear(upToId)', () => {
  it('removes only entries up to the given id, so later ones stay for the next bug', () => {
    const bc = createBugcrumbs()
    bc.mark('one')
    bc.mark('two')
    const last = bc.getEntries().at(-1)!.id
    bc.mark('three')
    bc.clear(last)
    expect(bc.getEntries().map((entry) => entry.kind === 'step' && entry.label)).toEqual(['three'])
  })
})
