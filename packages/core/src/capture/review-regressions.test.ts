/** Regression tests for the safety review of the capture layer (findings numbered as in that review). */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBugcrumbs } from '../bugcrumbs'
import { REDACTED } from '../redact'
import type { NetworkEntry } from '../types'
import { patchConsole } from './console'
import { listenForErrors } from './errors'
import { patchFetch } from './fetch'
import { MAX_PARSE_LENGTH, readCapped } from './network-shared'
import { patchMethod } from './patch'
import { recordSteps } from './steps'
import { patchXhr } from './xhr'

const realFetch = globalThis.fetch
const realXhr = globalThis.XMLHttpRequest
afterEach(() => {
  globalThis.fetch = realFetch
  globalThis.XMLHttpRequest = realXhr
  vi.restoreAllMocks()
})

const network = (bc: ReturnType<typeof createBugcrumbs>) =>
  bc.getEntries().filter((entry): entry is NetworkEntry => entry.kind === 'network')

describe('fetch', () => {
  it('(2) passes through a mock that returns a non-promise', () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch
    patchFetch(createBugcrumbs(), {})
    expect(() => fetch('/ping')).not.toThrow()
    expect(fetch('/ping')).toBeUndefined()
  })

  it('(3) does not read ndjson streams or bodies declared too large', async () => {
    const bc = createBugcrumbs()
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('stream')
        ? new Response('{"a":1}\n', { headers: { 'content-type': 'application/x-ndjson' } })
        : new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': String(MAX_PARSE_LENGTH + 1) } }),
    )
    patchFetch(bc, {})
    await fetch('/stream')
    await fetch('/huge')
    await vi.waitFor(() => expect(network(bc)).toHaveLength(2))
    expect(network(bc).map((entry) => entry.responseBody)).toEqual(['[application/x-ndjson body]', '[body omitted: too large]'])
  })

  it('(3) stops reading at the cap and cancels its copy of the stream', async () => {
    let cancelled = false
    const chunk = new TextEncoder().encode('x'.repeat(400_000))
    const endless = new ReadableStream<Uint8Array>({
      pull: (controller) => controller.enqueue(chunk),
      cancel: () => {
        cancelled = true
      },
    })
    const text = await readCapped(endless)
    expect(text!.length).toBeGreaterThan(MAX_PARSE_LENGTH)
    expect(text!.length).toBeLessThan(MAX_PARSE_LENGTH + chunk.length + 1)
    expect(cancelled).toBe(true)
  })

  it('(4) does not read binary Request bodies', async () => {
    const bc = createBugcrumbs()
    globalThis.fetch = vi.fn(async () => new Response('ok'))
    patchFetch(bc, {})
    const upload = new Request('http://localhost:3000/upload', {
      method: 'POST',
      body: new Uint8Array([1, 2, 3]),
      headers: { 'content-type': 'application/octet-stream' },
    })
    await fetch(upload)
    await vi.waitFor(() => expect(network(bc)[0]?.requestBody).toBe('[application/octet-stream body]'))
  })
})

describe('errors', () => {
  it('(5) redacts tokens in failed resource URLs', () => {
    const bc = createBugcrumbs()
    const stop = listenForErrors(bc)
    const image = document.createElement('img')
    image.setAttribute('src', 'https://bucket.s3.amazonaws.com/a.png?X-Amz-Security-Token=abc&size=2')
    document.body.append(image)
    image.dispatchEvent(new Event('error'))
    image.remove()
    stop()
    expect(bc.getEntries()[0]).toMatchObject({
      message: `Failed to load <img> https://bucket.s3.amazonaws.com/a.png?X-Amz-Security-Token=${encodeURIComponent(REDACTED)}&size=2`,
    })
  })

  it('(12) always has a string message, even for Promise.reject()', () => {
    const bc = createBugcrumbs()
    const stop = listenForErrors(bc)
    window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: undefined }))
    stop()
    expect(bc.getEntries()[0]).toMatchObject({ message: 'undefined' })
  })
})

describe('patchMethod', () => {
  it('(6) skips frozen objects instead of throwing', () => {
    const frozen = Object.freeze({ log: () => 1 })
    expect(() => patchMethod(frozen, 'log', (original) => original)()).not.toThrow()
  })

  it('(7) removes inherited methods on uninstall instead of shadowing the prototype', () => {
    const stop = recordSteps(createBugcrumbs())
    expect(Object.prototype.hasOwnProperty.call(history, 'pushState')).toBe(true)
    stop()
    expect(Object.prototype.hasOwnProperty.call(history, 'pushState')).toBe(false)
  })
})

describe('console', () => {
  it('(8) bounds the size of one console call', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const bc = createBugcrumbs()
    const stop = patchConsole(bc)
    const big = Array.from({ length: 100 }, () => 'y'.repeat(2000))
    console.log(...big)
    stop()
    const args = bc.getEntries()[0]?.kind === 'console' ? (bc.getEntries()[0] as { args: unknown[] }).args : []
    expect(args).toHaveLength(21)
    expect(JSON.stringify(args).length).toBeLessThan(70_000)
  })
})

describe('xhr', () => {
  class FakeXhr extends EventTarget {
    status = 200
    responseType = ''
    responseText = '{}'
    open() {}
    setRequestHeader() {}
    send() {}
    getAllResponseHeaders() {
      return ''
    }
  }

  it('(11) records one entry per request despite a repeated send() or a reopen', () => {
    globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest
    const bc = createBugcrumbs()
    const stop = patchXhr(bc, {})
    const xhr = new XMLHttpRequest()

    xhr.open('GET', '/first')
    xhr.send()
    xhr.send()
    xhr.open('GET', '/second')
    xhr.send()
    xhr.dispatchEvent(new Event('loadend'))
    stop()

    expect(network(bc).map((entry) => entry.url)).toEqual(['http://localhost:3000/second'])
  })
})

describe('URL allow and block lists (FR-22)', () => {
  it('skips blocked URLs and anything outside the allow list, for fetch and XHR', async () => {
    globalThis.fetch = vi.fn(async () => new Response('ok'))
    const bc = createBugcrumbs()
    const options = { allowUrls: ['/api/'], blockUrls: [/\/api\/health/] }
    patchFetch(bc, options)

    await fetch('/api/orders')
    await fetch('/api/health')
    await fetch('https://analytics.example.com/collect')
    await vi.waitFor(() => expect(network(bc)).toHaveLength(1))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(network(bc).map((entry) => entry.url)).toEqual(['http://localhost:3000/api/orders'])

    class FakeXhr extends EventTarget {
      status = 200
      responseType = ''
      responseText = ''
      open() {}
      setRequestHeader() {}
      send() {}
      getAllResponseHeaders() {
        return ''
      }
    }
    globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest
    const stop = patchXhr(bc, options)
    const xhr = new XMLHttpRequest()
    xhr.open('GET', '/api/health')
    xhr.send()
    xhr.dispatchEvent(new Event('loadend'))
    stop()
    expect(network(bc)).toHaveLength(1)
  })
})
