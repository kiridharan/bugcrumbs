# @bugcrumbs/core

## 0.1.0

### Minor Changes

- First MVP release: background capture of network (fetch/XHR), console, errors, repro steps and device info, with redaction at capture time and URL allow/block lists; TanStack Query adapter; masked DOM screenshots; and a report panel that exports self-contained HTML, JSON and Markdown, or copies Markdown shaped for AI coding tools.
- Report panel UX: compact capture summary with expandable details, screenshot Copy image / Download PNG / Retake, title suggestion from the latest failure, and only the title required by default. New `actions`, `moreActions`, `fields` (including custom fields) and `savedReports` props on `<BugcrumbsDevtools />`, with custom actions. "Save and start next" keeps finished bugs in IndexedDB and exports them all as CSV (Excel and Jira CSV import) or JSON. Core adds `toCSV`, `toJiraMarkup`, `suggestTitle` and optional `ReportForm.extra` fields, and `instance.clear(upToId)` (FR-09, FR-13, FR-14, FR-16).
