import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBugcrumbs } from '../bugcrumbs'
import { REDACTED } from '../redact'
import type { NetworkEntry } from '../types'
import { patchFetch, untracked } from './fetch'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

const network = (bc: ReturnType<typeof createBugcrumbs>) =>
  bc.getEntries().filter((entry): entry is NetworkEntry => entry.kind === 'network')

describe('patchFetch (FR-01)', () => {
  it('records method, status, headers and bodies, redacted, without consuming the response', async () => {
    const fake = vi.fn(async () =>
      new Response(JSON.stringify({ token: 'server-secret', error: 'Nope' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    )
    globalThis.fetch = fake
    const bc = createBugcrumbs()
    patchFetch(bc, {})

    const response = await fetch('/api/login?api_key=abc&page=2', {
      method: 'post',
      headers: { Authorization: 'Bearer abc', 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'ada@example.com', password: 'hunter2' }),
    })
    expect(await response.json()).toEqual({ token: 'server-secret', error: 'Nope' })

    await vi.waitFor(() => expect(network(bc)).toHaveLength(1))
    const [entry] = network(bc)
    expect(entry).toMatchObject({
      method: 'POST',
      url: `http://localhost:3000/api/login?api_key=${encodeURIComponent(REDACTED)}&page=2`,
      status: 500,
      failed: true,
      requestHeaders: { authorization: REDACTED, 'content-type': 'application/json' },
      requestBody: { email: 'ada@example.com', password: REDACTED },
      responseBody: { token: REDACTED, error: 'Nope' },
    })
    expect(entry?.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('rethrows network errors unchanged and records them as status 0', async () => {
    const failure = new TypeError('Failed to fetch')
    globalThis.fetch = vi.fn(async () => {
      throw failure
    })
    const bc = createBugcrumbs()
    patchFetch(bc, {})

    await expect(fetch('/down')).rejects.toBe(failure)
    await vi.waitFor(() => expect(network(bc)[0]).toMatchObject({ status: 0, failed: true, error: 'Failed to fetch' }))
  })

  it('reads the body of a Request object without consuming it', async () => {
    let sentBody = ''
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      sentBody = await (input as Request).text()
      return new Response('ok')
    })
    const bc = createBugcrumbs()
    patchFetch(bc, {})

    await fetch(new Request('http://localhost:3000/form', { method: 'PUT', body: 'otp=1234&name=ada', headers: { 'content-type': 'application/x-www-form-urlencoded' } }))
    expect(sentBody).toBe('otp=1234&name=ada')
    await vi.waitFor(() => expect(network(bc)[0]?.requestBody).toEqual({ otp: REDACTED, name: 'ada' }))
  })

  it('does not read event streams', async () => {
    globalThis.fetch = vi.fn(async () => new Response('data: 1\n\n', { headers: { 'content-type': 'text/event-stream' } }))
    const bc = createBugcrumbs()
    patchFetch(bc, {})
    await fetch('/events')
    await vi.waitFor(() => expect(network(bc)[0]?.responseBody).toBe('[text/event-stream body]'))
  })

  it('skips requests Bugcrumbs makes itself', async () => {
    globalThis.fetch = vi.fn(async () => new Response('img'))
    const bc = createBugcrumbs()
    patchFetch(bc, {})
    const init = untracked({ cache: 'force-cache' as const })
    // Libraries often spread init objects; the marker must survive that.
    await fetch('/logo.png', { ...init })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(network(bc)).toHaveLength(0)
  })

  it('restores the original fetch on uninstall', () => {
    const original = vi.fn()
    globalThis.fetch = original
    const stop = patchFetch(createBugcrumbs(), {})
    expect(globalThis.fetch).not.toBe(original)
    stop()
    expect(globalThis.fetch).toBe(original)
  })

  it('keeps a patch installed on top of ours working after uninstall', async () => {
    globalThis.fetch = vi.fn(async () => new Response('ok'))
    const bc = createBugcrumbs()
    const stop = patchFetch(bc, {})
    const ours = globalThis.fetch
    const theirs = vi.fn((...args: Parameters<typeof fetch>) => ours(...args))
    globalThis.fetch = theirs

    stop()
    expect(globalThis.fetch).toBe(theirs)
    await fetch('/after')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(theirs).toHaveBeenCalledOnce()
    expect(network(bc)).toHaveLength(0)
  })
})
