# Contributing to Bugcrumbs

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Before you start

- **Bugs:** open an issue with the bug report template. A Bugcrumbs report (HTML or JSON) attached to it is ideal.
- **Features:** open an issue first so we can agree on scope. The roadmap is in [`Bugcrumbs — Scope & PRD.md`](./Bugcrumbs%20—%20Scope%20&%20PRD.md); requirement IDs such as `FR-09` come from there.
- **Small fixes** (typos, docs, tests) can go straight to a pull request.
- Look for issues labelled `good first issue` if you want somewhere to start.

## Setup

Requires Node.js 22.18+ (24 recommended) and pnpm 10 (`corepack enable` sets it up).

```bash
pnpm install
pnpm build              # build all packages
pnpm dev                # run the demo shop (examples/vite-react) with Bugcrumbs enabled
```

| Command | What it does |
| --- | --- |
| `pnpm test` | Unit tests (Vitest + happy-dom) |
| `pnpm typecheck` | TypeScript in every package |
| `pnpm size` | Builds, then fails if `@bugcrumbs/core` is over 15 KB |
| `pnpm test:e2e` | Builds, then runs Playwright against the demo in Chrome (`PW_CHANNEL=` uses bundled Chromium) |
| `pnpm changeset` | Describes your change for the changelog |

Run `pnpm typecheck && pnpm test` before opening a pull request, and `pnpm size` if you touched `packages/core`.

## Rules every change keeps

Bugcrumbs runs inside other people's apps, so these are not negotiable:

1. **No network calls from the SDK.** No telemetry, no CDN fetches.
2. **Never break the host app.** Every patch calls through to the original, keeps its return value, `this` and thrown errors, and swallows only its own errors.
3. **No render loops.** Never update React state synchronously from an interceptor.
4. **Redact before storage.** Sensitive values never sit in the buffer, not even briefly.
5. **Off in production by default.**
6. **Strict-CSP compatible.** No `eval` or `new Function`.
7. **Bundle budget.** Core stays under 15 KB gzipped; heavy code is loaded with `import()`.
8. **Coexistence.** Works alongside Sentry, MSW, axios interceptors and OpenTelemetry, and uninstalls cleanly.

## Code conventions

- TypeScript `strict`, no `any` in public types. `isolatedDeclarations` is on, so exported functions need explicit return types.
- Tests sit next to the code as `src/*.test.ts(x)`. Every interceptor needs tests for passthrough, thrown errors, redaction and uninstall.
- Anything visual or browser-specific (screenshots, the widget) also needs a Playwright test in `e2e/`.
- The widget must be keyboard-operable and meet WCAG 2.1 AA contrast.

## Pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/) for the title, e.g. `feat(core): capture WebSocket errors (FR-01)`.
- Add a changeset (`pnpm changeset`) for any change to a published package.
- Public API changes also update the quick start in `README.md`.
- Keep pull requests focused; several small ones are easier to review than one large one.

By contributing, you agree that your contributions are licensed under the [MIT License](./LICENSE), and to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).
