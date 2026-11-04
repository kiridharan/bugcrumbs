# @bugcrumbs/react

One-click bug reports for React apps. Testers click a button; developers get the screenshot, repro steps, failed requests, console errors and app state in one file. Open source, with no vendor cloud. Part of [Bugcrumbs](https://github.com/kiridharan/bugcrumbs).

```bash
npm i @bugcrumbs/core @bugcrumbs/react
```

```tsx
import { BugcrumbsDevtools } from '@bugcrumbs/react'

<BugcrumbsDevtools enabled={import.meta.env.VITE_BUGCRUMBS} />
```

Set `VITE_BUGCRUMBS=true` in your QA or staging env file only: Bugcrumbs renders nothing and captures nothing unless it's enabled.

Also included: `BugcrumbsErrorBoundary` and `bugcrumbsRootOptions()` for React 19 root error hooks. Panel options (`actions`, `fields`, `savedReports`) are documented in the [main README](https://github.com/kiridharan/bugcrumbs#panel-options).

React 18 or 19 · MIT licence
