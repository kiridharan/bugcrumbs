---
name: fr-status
description: Report implementation status of Bugcrumbs functional requirements (FR-01..FR-24) against the PRD — which are done, partial, untested or missing for a release. Use when asked about progress, release readiness, MVP status, or "what's left".
---

# Functional requirement status

1. Read the "Functional requirements" table in `Bugcrumbs — Scope & PRD.md`. Filter to the release the user asks about (default: MVP / P0).
2. For each FR, search the code and tests (`grep -rn "FR-NN"`, plus searching for the feature itself — e.g. `XMLHttpRequest` for FR-01, `unhandledrejection` for FR-03).
3. Classify each as **Done** (implemented + tested), **Partial** (implemented, gaps or no tests), or **Missing**. Cite `file:line` evidence; don't mark Done without a test.
4. Also check the NFR gates that block a release: `pnpm size` (core < 15 KB gz), and that the production guard and redaction tests exist.
5. Output a compact table (ID, requirement, status, evidence/gap) followed by the shortest list of next steps to close the release.
