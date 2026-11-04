# Bugcrumbs

One-click bug reports for React apps — console, network, errors, repro steps and app state (TanStack Query) — with **no vendor cloud**. MIT licensed.

> Status: v0.1.0 (MVP) is out on npm. See the [release notes](https://github.com/kiridharan/bugcrumbs/releases/tag/v0.1.0) and the roadmap in [`Bugcrumbs — Scope & PRD.md`](./Bugcrumbs%20—%20Scope%20&%20PRD.md).

## Quick start

```bash
npm i @bugcrumbs/core @bugcrumbs/react @bugcrumbs/query
```

```tsx
import { createRoot } from 'react-dom/client'
import { startCapture } from '@bugcrumbs/core'
import { trackQueryClient } from '@bugcrumbs/query'
import { BugcrumbsDevtools, bugcrumbsRootOptions } from '@bugcrumbs/react'

// Optional: start before rendering so the very first requests are captured too.
startCapture({ enabled: import.meta.env.VITE_BUGCRUMBS })
trackQueryClient(queryClient)

createRoot(el, bugcrumbsRootOptions()).render(
  <>
    <App />
    <BugcrumbsDevtools enabled={import.meta.env.VITE_BUGCRUMBS} />
  </>,
)
```

Set `VITE_BUGCRUMBS=true` in your QA or staging env file only. Bugcrumbs renders nothing and captures nothing unless it's enabled or the host is in `allowedHosts`; the adapter and error hooks are no-ops until then. If it is enabled in a production build, it logs a one-time warning.

### What testers get

A floating **Bugcrumbs** button with a count of failures. It opens a compact panel with:

- a one-line summary of what was captured (failed requests, errors, failed queries, console errors, steps), with **Show details** for the full list
- **Take screenshot**: an approximate DOM screenshot of the visible page, with the widget left out and sensitive fields masked. Then **Copy image** (paste it straight into a ticket or chat), **Download PNG**, **Retake** or **Remove**. Click the preview to open it full size.
- a short form: only the title is required, and Bugcrumbs offers one from the latest failure (e.g. "GET /api/cart fails (503)")
- **Copy for AI** and **Download HTML report** up front; **Copy Markdown**, **Copy for Jira**, JSON and Markdown downloads under **More formats**
- **Save and start next**: keeps the bug in this browser, then clears the form, screenshot and captured history so the next report holds only the next bug. Saved bugs survive a reload. Export them all at once as **CSV** (opens in Excel; columns match Jira's CSV importer) or JSON.

### Options

```tsx
<BugcrumbsDevtools
  enabled={import.meta.env.VITE_BUGCRUMBS}
  allowedHosts={['staging.example.com']}  // enable on these hosts even without the flag
  allowUrls={['/api/']}                   // only record matching requests (see below)
  blockUrls={[/\/health$/, 'analytics.']} // never record these; wins over allowUrls
  maxBodyLength={16_384}                  // characters kept per request/response body
  console={false}                         // turn off a capture source: network, console, errors, steps
/>
```

Pass the same options to `startCapture()`; whichever call starts capture first decides them.

### Panel options

Choose what the panel shows. All of these are optional:

```tsx
<BugcrumbsDevtools
  enabled={import.meta.env.VITE_BUGCRUMBS}
  // Buttons always shown; the first is the primary action and runs on Enter.
  actions={['copy-ai', 'copy-jira']}
  // Behind "More formats". Pass [] to hide it.
  moreActions={['download-html', 'download-json']}
  fields={{
    description: 'required',   // 'required' | 'optional' (default) | 'hidden'
    expected: 'hidden',
    severity: 'optional',      // 'optional' (default) | 'hidden'
    custom: [
      { id: 'build', label: 'Build number', required: true },
      { id: 'area', label: 'Area', type: 'select', options: ['Checkout', 'Search'] },
    ],
  }}
  savedReports={false}         // hide "Save and start next" and the saved list
/>
```

Built-in actions: `copy-ai`, `copy-markdown`, `copy-jira`, `download-html`, `download-json`, `download-markdown`. Custom fields appear in every export under their label, and are redacted like the rest of the form.

You can add your own action too. It gets the report, already redacted, and the screenshot as a PNG `Blob`. It runs inside the click, so it can write to the clipboard:

```tsx
actions={['copy-ai', { label: 'Send to QA channel', run: (report, { screenshot }) => postToOurWebhook(report, screenshot) }]}
```

Bugcrumbs itself never sends anything. A custom action that does is your code and your choice.

**Jira:** Bugcrumbs doesn't connect to Jira; direct issue creation is planned for the self-hosted Hub (v2.0). Until then, use **Copy for Jira** (Jira wiki markup for the description) or import the CSV with Jira's *Import issues from CSV*. The Summary, Issue Type, Priority and Description columns map directly, and severity maps to priority (critical → Highest).

`allowUrls` and `blockUrls` are checked against the full absolute URL, query string included. A string matches anywhere in it, so `'api.example.com'` would also match `https://other.site/?next=api.example.com`. Use a RegExp such as `/^https:\/\/api\.example\.com\//` when that matters.

### Privacy by default

Nothing is sent anywhere: reports are files the tester downloads or copies. Before anything is stored, Bugcrumbs redacts:

- passwords, tokens, API keys, OTPs, card numbers, CVCs and session IDs, in headers, bodies, query strings and input values
- `Bearer` and `Basic` credentials and JWTs found inside log messages and error text

Screenshots mask the same fields. Add your own key patterns with `createBugcrumbs({ redact: { keys: [...] } })`.

Know the limits:

- **Free text can still contain secrets.** Redaction is pattern-based, so it catches `key=value` pairs, credentials and JWTs in free text, but not every secret. For example, a token without a label is not caught.
- **Screenshots mask only sensitive form fields.** These are fields detected by `type`, `name`, `id` or `autocomplete`. Other field values (email, address) and anything shown as plain page text are visible.
- **Screenshots are approximate.** They are re-rendered from the DOM. Cross-origin images, `<canvas>`, `<video>` and content inside an inner scrolling container may be missing or differ.
- **Saved bugs are stored in this browser** (IndexedDB, for this site only) until the tester deletes them, at most 50. They are redacted before saving, the same as downloads. If the browser blocks storage, they last only until the page reloads.
- **CSV cells that start with `=`, `+`, `-` or `@` get a leading `'`**, so Excel and Sheets don't run captured text as a formula.
- **"Copy for AI" marks captured content as untrusted.** The report goes inside a `<bug_report>` block marked as untrusted data, so AI tools are told not to follow instructions inside it. Still review what you paste into tools that can run commands.

### Requirements

- **React 18 or 19.** Works in the latest two versions of Chrome, Edge, Firefox and Safari.
- **Content-Security-Policy:**
  - Bugcrumbs never uses `eval`.
  - Screenshots and their preview need `img-src data: blob:`.
  - Re-fetching the page's own images and fonts for a screenshot needs those origins in `connect-src`. Blocked fetches leave gaps in the screenshot and may send CSP reports.
- **Code splitting:**
  - The report panel and screenshot code load with `import()` when a tester opens the widget.
  - Vite, webpack 5, Rollup and Next.js split these out automatically.
  - With esbuild, enable `--splitting`. Without it, or with Rollup's `inlineDynamicImports`, all of it ends up in your main bundle.

## Packages

| Package | Purpose |
| --- | --- |
| `@bugcrumbs/core` | Capture buffer, redaction, report model, plugin API |
| `@bugcrumbs/react` | `<BugcrumbsDevtools />`, error boundary, React 19 root error hooks |
| `@bugcrumbs/query` | TanStack Query adapter |
| `@bugcrumbs/screenshot` | DOM screenshot, loaded on demand by the widget |

## Development

```bash
pnpm install
pnpm test && pnpm typecheck
pnpm build && pnpm dev   # demo shop at examples/vite-react, with a mock API that fails
pnpm test:e2e            # Playwright in your local Chrome (PW_CHANNEL= for bundled Chromium)
pnpm size                # core must stay under 15 KB
```

The demo (`examples/vite-react`) is a small shop, Kettle & Co., with a shop, product pages, cart, checkout, orders, account settings and a sales dashboard, all backed by an in-memory mock API (`mock-api.ts`). Bugs are planted throughout. The **QA lab** page triggers every kind of failure Bugcrumbs captures and lists the planted bugs to practise reporting.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup and the rules every change keeps, and [SECURITY.md](./SECURITY.md) to report a vulnerability privately. This project follows a [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

MIT
