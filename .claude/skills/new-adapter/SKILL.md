---
name: new-adapter
description: Scaffold a new Bugcrumbs app-state adapter package (e.g. TanStack Query, Redux, Zustand, React Router) on the core plugin API. Use when asked to add or create an adapter/integration for a state or routing library.
---

# Create a Bugcrumbs adapter

Adapters live in `packages/<name>/` and publish as `@bugcrumbs/<name>`. They only push entries into core through the plugin API; they never render UI.

1. **Check scope.** TanStack Query is MVP (FR-07). Redux, Zustand, React Router are v1.0 (FR-24). Vue/Svelte are v2.0. If the requested adapter is outside the current phase, confirm with the user first.
2. **Copy the structure of an existing adapter** (`packages/query/` is the reference) — `package.json`, `tsconfig.json`, `tsdown.config.ts`, `src/index.ts`, `src/index.test.ts`, `README.md`.
3. **package.json:** the target library and `@bugcrumbs/core` are `peerDependencies`; `"sideEffects": false`; ESM exports with types.
4. **API shape:** one entry function, `track<Thing>(instance, options?)`, that returns an `uninstall()` function. Name it consistently with `trackQueryClient`.
5. **What to capture:** failures and the state a developer needs to reproduce them — key/action name, status, error message, and a *redacted, size-capped* snapshot of relevant state. Never capture whole stores unbounded.
6. **Safety:** subscribe using the library's public subscription API (no monkey-patching internals); wrap callbacks in try/catch; run all captured payloads through core's redaction before pushing.
7. **Tests:** capture of a failure, redaction of a sensitive field, uninstall stops capture, and no error thrown into the host when the adapter itself throws.
8. **Docs:** add a section to the package README and a line in the root README adapter list. Add a changeset.
9. Run `pnpm -F @bugcrumbs/<name> test` and `pnpm typecheck`, then ask the `safety-reviewer` agent to review.
