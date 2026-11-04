# @bugcrumbs/core

Framework-agnostic capture and report model for [Bugcrumbs](https://github.com/kiridharan/bugcrumbs): one-click bug reports with the screenshot, repro steps, network, console, errors and app state, and no vendor cloud.

Most apps use it through [`@bugcrumbs/react`](https://www.npmjs.com/package/@bugcrumbs/react). Use core directly to start capture early, add metadata or manual steps, or build reports yourself.

```bash
npm i @bugcrumbs/core
```

```ts
import { getBugcrumbs, startCapture } from '@bugcrumbs/core'

startCapture({ enabled: import.meta.env.VITE_BUGCRUMBS })
getBugcrumbs().setMetadata({ build: '1.4.2' })
getBugcrumbs().mark('Opened the checkout')
```

- Captures fetch, XHR, console, uncaught errors, rejections, failed resources and repro steps.
- Redacts passwords, tokens, cookies, API keys and card numbers at capture time.
- Makes no network calls and is off unless enabled.
- Exports HTML, JSON, Markdown, CSV (Jira import), Jira markup and Copy for AI.

Full docs: https://github.com/kiridharan/bugcrumbs#readme · MIT licence
