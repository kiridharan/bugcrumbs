# Bugcrumbs — Scope & PRD

Oct 27, 2026 · @kiridharanS

## Summary

Bugcrumbs is an open-source SDK that gives React apps Jam- and Gleap-style one-click bug reports: screenshot, replay, console, network, errors and repro steps, with no vendor cloud.

**Positioning:** bug reports that understand your React app. Free, local-first, and aware of app state such as TanStack Query, which browser extensions cannot see.

**Model:** the SDK is MIT-licensed and works with no server. An optional self-hosted Report Hub (Docker) adds shareable links, an inbox and Jira/GitHub/Slack integrations. That covers what Jam and Gleap do with their clouds, while the data stays on the team's own servers.

**Goal:** open-source adoption and a portfolio-grade engineering project. Revenue is not a goal for the first year.

**Status:** pre-validation. A working prototype exists for capture, the panel and the HTML/JSON/Markdown report.

## Problem and users

QA bug reports arrive without the context developers need, so every bug starts with a round of "which API failed?" and "send me the console". Testers on phones and tablets often cannot open DevTools at all. Paid tools fix this, but they send payloads to a vendor cloud and cap free usage.

| Persona | Who they are | Pain today | What they need |
| --- | --- | --- | --- |
| QA tester (primary user) | Manual or exploratory tester on staging and QA builds | Gathers HAR files, console output and screenshots by hand; forgets the exact steps | One click to file a complete report, nothing to install |
| Frontend developer (installer) | Adds the SDK and fixes the bugs | Vague tickets, bugs that cannot be reproduced | Full context including app state; paste straight into an AI coding tool |
| QA or engineering lead | Owns the testing process and tool choices | SaaS tools blocked by security review; per-seat costs | Self-hosted, redaction by default, free |
| Small team or OSS maintainer | 1–10 developers, no QA budget | Free tiers of paid tools run out | Zero setup, works locally |

Jobs to be done:

- When I hit a bug while testing, I want to send everything a developer needs in one action, so I don't get pulled back to explain it.
- When I get a bug report, I want to see the failing request, the error and the steps together, so I can reproduce it without asking.
- When I choose a tool for my team, I want our API data to stay on our own machines, so security approves it.

## Benchmark: Jam and Gleap

Bugcrumbs matches Jam and Gleap on in-browser capture by v1.0 and on sharing and integrations by v2.0. It differs in where data lives and in seeing app state.

| Capability | [Jam](https://jam.dev/) | [Gleap](https://www.gleap.io/product/in-app-bug-reporting) | Bugcrumbs target |
| --- | --- | --- | --- |
| How it is installed | Browser extension | In-app SDK | In-app SDK (npm) |
| Screenshot | Yes, with annotation | Yes, annotated | MVP; annotation in v1.0 |
| Replay or video | Screenshot, video or instant replay | 30–60 s session replay | v1.0: 60 s replay buffer and screen recording |
| Console logs | Yes | Yes | MVP |
| Network logs with payloads | Yes | Yes | MVP |
| Repro steps | Automatic | Yes | MVP |
| Device and browser data | Yes | Yes | MVP |
| Backend tracing | Yes | Not listed | v2.0: trace ID correlation |
| Shareable link | Hosted by Jam | Hosted by Gleap | v2.0: self-hosted Report Hub |
| Issue tracker integrations | Jira and others | Connected tools | v2.0: Jira, GitHub, Linear, Slack, webhook |
| AI features | AI titles and steps; MCP server | AI that plans fixes and opens PRs (Pro) | MVP: Copy for AI; v2.0: MCP server |
| App state (queries, store) | Not visible to an extension | Custom data via API | MVP: TanStack Query; v1.0: Redux, Zustand, router |
| Native mobile SDKs | No | iOS, Android, React Native, Flutter | Out of scope |
| Where data goes | Jam cloud | Gleap cloud | User's browser or own server |
| Price | Free: 30 Jams/month; Team: $14/seat/month | Team: $149/month | Free, MIT |

Where Bugcrumbs wins:

- **Data control:** nothing leaves the browser unless the team runs its own Hub. This suits banks, healthcare, government and client projects that block SaaS tools.
- **App awareness:** reports name the failing query key and its state, not just the raw HTTP call.
- **Developer-native:** installed with npm, no seat limits or report caps, in the style of TanStack Query Devtools.

Where it will not compete: hosted cloud, native mobile SDKs, and Gleap's support desk, surveys and feature-request boards.

## Goals, non-goals and success metrics

Success means developers install it in minutes and keep it, shown by people outside our circle filing issues and sending PRs.

Goals:

1. A tester files a complete report in under 30 seconds, with nothing to install.
2. A developer integrates the SDK in under 5 minutes.
3. No data leaves the browser unless the team runs its own Hub.
4. Reach Jam and Gleap capture parity in the browser by v1.0.

Non-goals:

- A hosted SaaS or paid tier in the first year
- Production monitoring or real-user analytics (Sentry and PostHog cover this)
- Native iOS, Android or Flutter SDKs
- Support desk, surveys or feature-request boards

Proposed targets, to be confirmed after the validation phase:

| Metric | Target | Measured at |
| --- | --- | --- |
| Time from npm install to first report | Under 5 min | Friends test, before MVP launch |
| Reports carrying steps, console and network | 100% | MVP dogfooding |
| Issues or PRs from people we don't know | 10 | 3 months after v1.0 |
| npm weekly downloads | 1,000 | 6 months after v1.0 |
| GitHub stars | 500 | 6 months after v1.0 |
| Core bundle size | Under 15 KB gzipped | Every release (CI check) |

## Scope by release

The MVP ships local capture and reports, v1.0 reaches Jam and Gleap parity inside the browser, and v2.0 adds the self-hosted Hub for links and integrations.

| Area | MVP (v0.1) | v1.0: browser parity | v2.0: Hub and integrations |
| --- | --- | --- | --- |
| Capture | Network (fetch, XHR), console, errors, repro steps, device data | Persist across reloads (IndexedDB) | Backend trace ID correlation |
| Visual | DOM screenshot | Annotation (arrow, box, text, blur), 60 s replay buffer, screen recording | Replay playback in the Hub viewer |
| App state | TanStack Query adapter | Redux, Zustand, React Router adapters; plugin API | Vue and Svelte adapters |
| Report | Form, HTML/JSON/Markdown export, Copy for AI | Severity and labels, report templates | Shareable links, inbox, comments |
| Integrations | None | Webhook from the browser | Jira, GitHub Issues, Linear, Slack; MCP server |
| Platform | React 18+, Vite and CRA | Next.js, vanilla JS widget | Docker image for the Hub |
| Privacy | Redaction by default, URL block list, dev-only guard | Custom redaction rules, element masking | Hub authentication and retention settings |

Out of scope for all releases: a hosted cloud, native mobile SDKs, production analytics, and support-desk features.

## Functional requirements

Fifteen of the 24 requirements are P0 and ship in the MVP; everything that needs a server waits for v2.0.

| ID | Area | Requirement | Priority | Release |
| --- | --- | --- | --- | --- |
| FR-01 | Capture | Intercept fetch and XHR: method, URL, status, timing, headers, text and JSON bodies | P0 | MVP |
| FR-02 | Capture | Console log, info, warn and error, with stack traces for warn and error | P0 | MVP |
| FR-03 | Capture | Uncaught errors, unhandled promise rejections and failed resource loads | P0 | MVP |
| FR-04 | Capture | React error boundary plus React 19 root error hooks, with component stack | P0 | MVP |
| FR-05 | Capture | Automatic repro steps from clicks, input changes and route changes; manual mark() | P0 | MVP |
| FR-06 | Capture | Device, browser, viewport, URL, app version and custom metadata | P0 | MVP |
| FR-07 | App state | TanStack Query adapter: failed queries and mutations with key and state | P0 | MVP |
| FR-08 | Capture | Rolling buffer with a size cap (default 1,000 entries) | P0 | MVP |
| FR-09 | Visual | One-click DOM screenshot that excludes the widget itself | P0 | MVP |
| FR-10 | Visual | Screenshot annotation: arrow, box, text and blur | P1 | v1.0 |
| FR-11 | Visual | Instant replay: last 60 s of DOM activity, recorded locally | P1 | v1.0 |
| FR-12 | Visual | Screen recording video up to 2 min | P2 | v1.0 |
| FR-13 | Report | Report form: title, what happened, expected result, severity | P0 | MVP |
| FR-14 | Report | Export as self-contained HTML viewer, JSON and Markdown | P0 | MVP |
| FR-15 | Report | Copy for AI: Markdown shaped for Claude, Cursor and Copilot | P0 | MVP |
| FR-16 | Report | Keep the session across page reloads (IndexedDB) | P1 | v1.0 |
| FR-17 | Sharing | Shareable report link through the self-hosted Hub | P1 | v2.0 |
| FR-18 | Sharing | Integrations: Jira, GitHub Issues, Linear, Slack, webhook | P1 | v2.0 |
| FR-19 | Sharing | MCP server so AI coding tools can read reports | P2 | v2.0 |
| FR-20 | Capture | Backend trace correlation through the W3C traceparent header | P2 | v2.0 |
| FR-21 | Privacy | Redact sensitive keys in headers, bodies and inputs by default; custom rules | P0 | MVP |
| FR-22 | Privacy | URL allow and block lists for network capture | P0 | MVP |
| FR-23 | Privacy | Active only behind an env flag or allowed hosts; off in production builds by default | P0 | MVP |
| FR-24 | App state | Redux, Zustand and React Router adapters on a public plugin API | P1 | v1.0 |

## Key user flows

Four flows define the product: install, file a report, fix from a report, and (in v2.0) send a report to a tracker.

**Developer installs the SDK (MVP)**

1. Run `npm i @bugcrumbs/core @bugcrumbs/react`.
2. Add `<BugcrumbsDevtools />` and an optional adapter such as `trackQueryClient(queryClient)`.
3. Set `VITE_BUGCRUMBS=true` in the QA or staging env file.
4. Deploy to staging; the floating Bugcrumbs button appears there only.

**Tester files a bug (MVP)**

1. Tests the app as usual; capture runs silently in the background.
2. Sees a red count on the Bugcrumbs button when a request or script fails.
3. Takes a screenshot, and in v1.0 annotates it.
4. Clicks Create report and enters a title, what happened and what was expected.
5. Downloads the HTML report or copies Markdown, then attaches it to the ticket.

**Developer fixes the bug (MVP)**

1. Opens the HTML report in any browser.
2. Reads the steps, the failed request with its payload, the error stack and the query key.
3. Optionally clicks Copy for AI and pastes into Claude, Cursor or Copilot.
4. Reproduces and fixes the bug without asking the tester anything.

**Report goes to a tracker (v2.0)**

1. The tester clicks Send report.
2. The SDK uploads it to the team's self-hosted Hub.
3. The Hub creates a Jira, GitHub or Linear issue with a link to the report viewer.
4. Developers open the link, watch the replay and comment.

## Non-functional requirements

The SDK must be safe by default: it never sends data anywhere on its own, is off in production builds, and can never break the host app.

| Area | Requirement |
| --- | --- |
| Privacy | No network calls from the SDK unless a Hub URL is configured. Data stays in memory or IndexedDB on the tester's device. |
| Privacy | Passwords, tokens, auth headers, cookies, API keys, OTPs and card fields are redacted before storage. Teams can add rules. |
| Security | Disabled in production builds unless explicitly enabled. No eval; works under a strict content-security policy. |
| Security | The Hub requires login (SSO in a later release) and has configurable retention. |
| Reliability | Every interceptor is wrapped so an SDK error never breaks the app. Logging inside React render cannot trigger a re-render loop. |
| Performance | Core under 15 KB gzipped; the widget, screenshot and replay code load lazily. |
| Performance | Under 1 ms of added time per intercepted request; replay buffer capped at 20 MB of memory. |
| Compatibility | React 18 and 19; latest 2 versions of Chrome, Edge, Firefox and Safari, including mobile Safari and Chrome. |
| Compatibility | Works alongside Sentry, MSW, axios interceptors and OpenTelemetry; covered by integration tests. |
| Accessibility | Widget is fully keyboard-operable and meets WCAG 2.1 AA contrast. |
| Developer experience | TypeScript types, tree-shakable ESM, a 5-minute quick start, a live demo and example apps. |
| Licensing | SDK under MIT. Hub licence to be decided (see open questions). |

## Architecture and packages

The SDK is a set of small npm packages that work with no server; the Hub is a separate, optional Docker service.

&#91;embedded content: SDK packages and the optional Hub\]

Core captures everything and the other packages plug into it, so adapters and replay stay optional and tree-shakable. A team that never runs the Hub still gets complete reports as files.

## Roadmap and milestones

The plan runs about nine months from today, with a gate between each phase; a failed gate means stop or pivot, not push on.

&#91;embedded content: Roadmap: four phases, three gates\]

Durations assume one part-time maintainer and are not to scale. The validation phase starts now and is the only phase committed to.

## Risks and open questions

The biggest risk is low adoption, because developers already have Jam's free plan and DevTools; validation in the first three weeks exists to test this cheaply.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Developers see no need beyond Jam's free plan or DevTools | Low adoption | Lead with privacy and app state; stop or pivot if the validation gate fails |
| Patching fetch and XHR conflicts with Sentry, MSW or OpenTelemetry | Broken apps, lost trust | Chain to existing patches; integration tests against each library |
| DOM screenshots miss cross-origin images, canvas and video | Misleading screenshots | Offer screen-capture mode; label DOM shots as approximate |
| Replay and logs leak personal data | Security incident | Redaction and masking on by default; documented threat model |
| Accidentally shipped to production users | Data exposure | Production guard on by default; build-time warning |
| Scope grows to chase Jam and Gleap feature for feature | Nothing ships | Hold release scopes; Hub only after v1.0 adoption gate |
| Single maintainer burns out | Project stalls | Small core; adapters as contributor-friendly packages |

Open questions:

- [ ] Name is Bugcrumbs (free on npm and GitHub on 27 Oct 2026); still to check the domain, the npm org scope and trademarks.
- [ ] Hub licence: MIT like the SDK, or AGPL to prevent closed hosted forks?
- [ ] Replay: build on rrweb, or write a smaller recorder?
- [ ] Should v1.0 support Vue and Svelte through a framework-agnostic widget, or stay React-only?
- [ ] Which issue tracker comes first in v2.0: Jira or GitHub Issues?

## Sources

- [Jam homepage](https://jam.dev/) and [Jam pricing](https://jam.dev/pricing)
- [Jam plan details, Toolradar](https://toolradar.com/tools/jam/alternatives)
- [Jam MCP server, Developers Digest](https://www.developersdigest.tech/mcp-servers/jam)
- [Gleap in-app bug reporting](https://www.gleap.io/product/in-app-bug-reporting)
- [Gleap console and network logs help article](https://help.gleap.io/en/articles/365-console-logs-network-requests-and-replays)
- [Gleap overview, Osher](https://osher.com.au/tools/gleap/)
