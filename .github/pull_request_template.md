## What and why

<!-- What does this change, and which issue or requirement (FR-xx) does it address? -->

## Checklist

- [ ] `pnpm typecheck && pnpm test` pass
- [ ] `pnpm size` passes (if `packages/core` changed)
- [ ] Tests added or updated (interceptors: passthrough, thrown errors, redaction, uninstall)
- [ ] Changeset added (`pnpm changeset`) for changes to a published package
- [ ] README quick start updated (for public API changes)
- [ ] No new network calls, `eval`, or unredacted data in the buffer
