import type { Entry, Report } from '../types'
import { describeEntry, formatTime, stringify, summarize } from './create'

/** Every value in a report can come from the app or its servers, so everything is escaped. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const code = (value: unknown, max?: number) => `<pre><code>${escapeHtml(stringify(value, max))}</code></pre>`

function headersTable(headers: Record<string, string> | undefined): string {
  if (!headers || !Object.keys(headers).length) return ''
  const rows = Object.entries(headers)
    .map(([name, value]) => `<tr><th scope="row">${escapeHtml(name)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join('')
  return `<table class="kv">${rows}</table>`
}

function entryDetail(entry: Entry): string {
  switch (entry.kind) {
    case 'network':
      return [
        entry.requestHeaders && `<h4>Request headers</h4>${headersTable(entry.requestHeaders)}`,
        entry.requestBody !== undefined && `<h4>Request body</h4>${code(entry.requestBody)}`,
        entry.responseHeaders && `<h4>Response headers</h4>${headersTable(entry.responseHeaders)}`,
        entry.responseBody !== undefined && `<h4>Response body</h4>${code(entry.responseBody)}`,
      ]
        .filter(Boolean)
        .join('')
    case 'console':
      return [code(entry.args), entry.stack && `<h4>Stack</h4>${code(entry.stack)}`].filter(Boolean).join('')
    case 'error':
      return [entry.stack && code(entry.stack), entry.componentStack && `<h4>Component stack</h4>${code(entry.componentStack)}`].filter(Boolean).join('')
    case 'state':
      return entry.data === undefined ? '' : code(entry.data)
    case 'step':
      return ''
  }
}

function entryItem(entry: Entry, failed: boolean): string {
  const detail = entryDetail(entry)
  const kind = escapeHtml(entry.kind)
  const summary = `<span class="time">${formatTime(entry.time)}</span> <span class="kind kind-${kind}">${kind}</span> <span class="${failed ? 'fail' : ''}">${escapeHtml(describeEntry(entry))}</span>`
  return detail ? `<details><summary>${summary}</summary><div class="detail">${detail}</div></details>` : `<div class="row">${summary}</div>`
}

const isFailed = (entry: Entry) =>
  entry.kind === 'error' ||
  (entry.kind === 'network' && entry.failed) ||
  (entry.kind === 'console' && entry.level === 'error') ||
  (entry.kind === 'state' && entry.status === 'error')

function section(title: string, items: Entry[], open = true): string {
  if (!items.length) return ''
  return `<section><details${open ? ' open' : ''}><summary><h2>${escapeHtml(title)} <span class="count">${items.length}</span></h2></summary>${items
    .map((entry) => entryItem(entry, isFailed(entry)))
    .join('')}</details></section>`
}

const STYLE = `
:root{--bg:#fff;--fg:#111827;--muted:#4b5563;--line:#e5e7eb;--panel:#f9fafb;--fail:#b91c1c;--accent:#1d4ed8;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#111827;--fg:#f3f4f6;--muted:#9ca3af;--line:#374151;--panel:#1f2937;--fail:#f87171;--accent:#93c5fd}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:960px;margin:0 auto;padding:24px 16px 48px}h1{font-size:24px;margin:0 0 4px}h2{display:inline;font-size:18px;margin:0}h4{margin:12px 0 4px;font-size:13px;color:var(--muted)}
.meta{color:var(--muted);font-size:13px}.badge{display:inline-block;padding:0 8px;border-radius:999px;border:1px solid currentColor;font-size:12px;text-transform:uppercase;margin-right:8px}
.sev-high,.sev-critical{color:var(--fail)}section{margin-top:24px;border-top:1px solid var(--line);padding-top:12px}
.counts{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.counts span{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:2px 10px;font-size:13px}
.count{color:var(--muted);font-weight:400;font-size:14px}summary{cursor:pointer}details>div,details>details,.row{margin:4px 0}
.detail{padding:4px 0 8px 16px}.time{color:var(--muted);font:12px ui-monospace,monospace}.kind{font:11px ui-monospace,monospace;text-transform:uppercase;color:var(--accent)}
.fail{color:var(--fail)}pre{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:8px;overflow:auto;max-height:420px;font:12px/1.45 ui-monospace,monospace;white-space:pre-wrap;word-break:break-word}
table.kv{border-collapse:collapse;font:12px ui-monospace,monospace;width:100%}table.kv th,table.kv td{border:1px solid var(--line);padding:2px 6px;text-align:left;vertical-align:top;word-break:break-all}table.kv th{width:30%;font-weight:600}
ol{padding-left:24px}figure{margin:12px 0 0}figure img{max-width:100%;border:1px solid var(--line);border-radius:6px}figcaption{color:var(--muted);font-size:13px}
.text{white-space:pre-wrap}`

/**
 * Self-contained HTML report viewer (FR-14): open it in any browser, no network or scripts needed.
 * The full report is embedded as inert JSON so tools can read it back.
 */
export function toHTML(report: Report): string {
  const { form, environment: env } = report
  const summary = summarize(report)
  const counts = [
    `${summary.failedRequests.length} failed requests`,
    `${summary.errors.length} errors`,
    `${summary.consoleProblems.length} console warnings/errors`,
    `${summary.failedState.length} failed queries`,
    `${summary.steps.length} steps`,
  ]
  const envRows: Record<string, string> = {
    URL: env.url,
    Browser: env.userAgent,
    Viewport: `${env.viewport.width}×${env.viewport.height} @${env.screen.pixelRatio}x`,
    Screen: `${env.screen.width}×${env.screen.height}`,
    Language: env.language,
    Timezone: env.timezone,
    ...(env.appVersion ? { 'App version': env.appVersion } : {}),
    ...Object.fromEntries(Object.entries(env.metadata ?? {}).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])),
  }
  // `<` is escaped so the data block can't close its own script tag. The screenshot is already
  // in the <img> above; embedding it twice would nearly triple the file size.
  const json = JSON.stringify({ ...report, screenshot: report.screenshot ? '[shown as the screenshot image]' : undefined }).replace(/</g, '\\u003c')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(form.title)} · Bugcrumbs report</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<header>
<h1>${escapeHtml(form.title)}</h1>
<div class="meta">${form.severity ? `<span class="badge sev-${escapeHtml(form.severity)}">${escapeHtml(form.severity)}</span>` : ''}Reported ${escapeHtml(report.createdAt)} on ${escapeHtml(env.url)}</div>
<div class="counts">${counts.map((count) => `<span>${count}</span>`).join('')}</div>
</header>
${form.description.trim() ? `<section><h2>What happened</h2><p class="text">${escapeHtml(form.description)}</p></section>` : ''}
${form.expected?.trim() ? `<section><h2>Expected result</h2><p class="text">${escapeHtml(form.expected)}</p></section>` : ''}
${form.extra?.length ? `<section><h2>Details</h2>${headersTable(Object.fromEntries(form.extra.map((field) => [field.label, field.value])))}</section>` : ''}
${
  report.screenshot && /^data:image\/(png|jpeg|webp);base64,/.test(report.screenshot)
    ? `<section><h2>Screenshot</h2><figure><img src="${escapeHtml(report.screenshot)}" alt="Screenshot of the page when the bug was reported"><figcaption>DOM screenshot — approximate; cross-origin images, canvas and video may be missing.</figcaption></figure></section>`
    : ''
}
<section><details open><summary><h2>Steps to reproduce <span class="count">${summary.steps.length}</span></h2></summary>${
    summary.steps.length
      ? `<ol>${summary.steps.map((step) => `<li>${escapeHtml(step.label)} <span class="time">${formatTime(step.time)}</span></li>`).join('')}</ol>`
      : '<p class="meta">No steps recorded.</p>'
  }</details></section>
${section('Failed requests', summary.failedRequests)}
${section('Errors', summary.errors)}
${section('Failed app state', summary.failedState)}
${section('Console warnings and errors', summary.consoleProblems)}
${section('Full timeline', report.entries, false)}
<section><h2>Environment</h2>${headersTable(envRows)}</section>
<footer class="meta" style="margin-top:32px">Bugcrumbs report · schema v${escapeHtml(report.schemaVersion)} · ${report.entries.length} captured entries · sensitive values shown as [redacted]</footer>
</main>
<script type="application/json" id="bugcrumbs-report">${json}</script>
</body>
</html>
`
}
