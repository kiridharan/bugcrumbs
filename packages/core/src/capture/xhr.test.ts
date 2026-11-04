import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBugcrumbs } from '../bugcrumbs'
import { REDACTED } from '../redact'
import { patchXhr } from './xhr'

/** Minimal XHR double; happy-dom's real one would try to hit the network. */
class FakeXhr extends EventTarget {
  status = 0
  responseType: XMLHttpRequestResponseType = ''
  responseText = ''
  response: unknown = ''
  openArgs: unknown[] = []
  sentBody: unknown
  headers: Record<string, string> = {}
  open(...args: unknown[]) {
    this.openArgs = args
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value
  }
  send(body?: unknown) {
    this.sentBody = body
  }
  getAllResponseHeaders() {
    return 'content-type: application/json\r\nx-request-id: 7\r\n'
  }
  respond(status: number, text: string) {
    this.status = status
    this.responseText = text
    this.response = text
    this.dispatchEvent(new Event('loadend'))
  }
}

const realXhr = globalThis.XMLHttpRequest
beforeEach(() => {
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest
})
afterEach(() => {
  globalThis.XMLHttpRequest = realXhr
})

describe('patchXhr (FR-01)', () => {
  it('records a failed request with redacted headers and bodies', () => {
    const bc = createBugcrumbs()
    patchXhr(bc, {})
    const xhr = new XMLHttpRequest() as unknown as FakeXhr

    xhr.open('PATCH', '/api/user')
    xhr.setRequestHeader('X-Api-Key', 'abc')
    xhr.send(JSON.stringify({ name: 'Ada', password: 'p' }))
    xhr.respond(422, JSON.stringify({ message: 'invalid', session: 's' }))

    expect(xhr.openArgs).toEqual(['PATCH', '/api/user'])
    expect(xhr.headers).toEqual({ 'X-Api-Key': 'abc' })
    expect(bc.getEntries()[0]).toMatchObject({
      kind: 'network',
      method: 'PATCH',
      url: 'http://localhost:3000/api/user',
      status: 422,
      failed: true,
      requestHeaders: { 'x-api-key': REDACTED },
      requestBody: { name: 'Ada', password: REDACTED },
      responseHeaders: { 'x-request-id': '7' },
      responseBody: { message: 'invalid', session: REDACTED },
    })
  })

  it('records aborts as network errors', () => {
    const bc = createBugcrumbs()
    patchXhr(bc, {})
    const xhr = new XMLHttpRequest() as unknown as FakeXhr
    xhr.open('GET', '/slow', true)
    xhr.send()
    xhr.dispatchEvent(new Event('abort'))
    xhr.respond(0, '')
    expect(xhr.openArgs).toEqual(['GET', '/slow', true])
    expect(bc.getEntries()[0]).toMatchObject({ status: 0, failed: true, error: 'Aborted' })
  })

  it('restores the prototype on uninstall', () => {
    const { open, send, setRequestHeader } = FakeXhr.prototype
    const stop = patchXhr(createBugcrumbs(), {})
    expect(FakeXhr.prototype.open).not.toBe(open)
    stop()
    expect(FakeXhr.prototype).toMatchObject({ open, send, setRequestHeader })
  })

  it('never throws into the app when capture fails', () => {
    const bc = createBugcrumbs()
    vi.spyOn(bc, 'push').mockImplementation(() => {
      throw new Error('sdk bug')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    patchXhr(bc, {})
    const xhr = new XMLHttpRequest() as unknown as FakeXhr
    xhr.open('GET', '/x')
    xhr.send()
    expect(() => xhr.respond(200, '{}')).not.toThrow()
    warn.mockRestore()
  })
})
