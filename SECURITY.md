# Security policy

Bugcrumbs runs inside other people's apps and handles data that may include personal information, so security reports are taken seriously.

## Reporting a vulnerability

**Please don't open a public issue.** Report it privately through GitHub:

https://github.com/kiridharan/bugcrumbs/security/advisories/new

Include what you found, how to reproduce it, and the impact you expect. You'll get a reply within 5 working days, and credit in the release notes if you want it.

## What counts

Especially welcome:

- Sensitive data that reaches a report, the clipboard or browser storage without being redacted
- Any network request the SDK makes on its own
- Script injection through an exported report (HTML, Markdown, CSV or Jira markup)
- Ways the SDK can break, slow down or crash the host app
- Bugcrumbs becoming active in production when it shouldn't be

## Supported versions

Bugcrumbs is pre-1.0. Fixes go into the latest published version only.
