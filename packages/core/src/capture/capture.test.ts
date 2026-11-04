import { describe, expect, it, vi } from 'vitest'
import { createBugcrumbs } from '../bugcrumbs'
import { redactUrl, REDACTED } from '../redact'
import { collectEnvironment } from './environment'
import { startCapture } from './index'
import { toSerializable } from './serialize'

describe('startCapture (FR-23)', () => {
  it('patches nothing when not enabled', () => {
    const before = console.log
    startCapture({}, createBugcrumbs())()
    expect(console.log).toBe(before)
  })

  it('stays active until every caller has stopped', () => {
    const before = console.info
    const bc = createBugcrumbs()
    const stopA = startCapture({ enabled: true }, bc)
    const stopB = startCapture({ enabled: true }, bc)
    stopA()
    stopA()
    expect(console.info).not.toBe(before)
    stopB()
    expect(console.info).toBe(before)
  })

  it('lets each source be turned off', () => {
    const before = console.log
    const stop = startCapture({ enabled: true, console: false }, createBugcrumbs())
    expect(console.log).toBe(before)
    stop()
  })
})

describe('collectEnvironment (FR-06)', () => {
  it('reports page, device and custom metadata, redacted', () => {
    const bc = createBugcrumbs({ appVersion: '1.2.3', metadata: { build: 'abc', apiKey: 'k' } })
    bc.setMetadata({ featureFlag: true })
    expect(bc.getEnvironment()).toMatchObject({
      url: 'http://localhost:3000/',
      appVersion: '1.2.3',
      metadata: { build: 'abc', apiKey: REDACTED, featureFlag: true },
      viewport: { width: expect.any(Number), height: expect.any(Number) },
      screen: { pixelRatio: expect.any(Number) },
    })
    expect(collectEnvironment().userAgent).toBeTruthy()
    expect(collectEnvironment().timezone).toBeTruthy()
  })
})

describe('redactUrl', () => {
  it('redacts query and hash params on absolute and relative URLs', () => {
    const r = encodeURIComponent(REDACTED)
    expect(redactUrl('https://x.dev/cb?code=1&state=2#access_token=t&type=bearer')).toBe(
      `https://x.dev/cb?code=1&state=2#access_token=${r}&type=bearer`,
    )
    expect(redactUrl('/a?password=p')).toBe(`/a?password=${r}`)
    expect(redactUrl('/plain#section')).toBe('/plain#section')
  })
})

describe('toSerializable', () => {
  it('bounds strings, arrays and total size', () => {
    expect(toSerializable('x'.repeat(10), { maxString: 4 })).toBe('xxxx… [6 more chars]')
    expect(toSerializable([1, 2, 3], { maxKeys: 2 })).toEqual([1, 2, '[1 more items]'])
    const wide = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, i]))
    expect(Object.values(toSerializable(wide, { maxNodes: 10 }) as object)).toContain('[truncated]')
    expect(toSerializable(() => 1)).toBe('[function anonymous]')
    expect(toSerializable(new Map([['a', 1n]]))).toEqual({ a: '1n' })
  })

  it('never throws on hostile getters', () => {
    const hostile = Object.defineProperty({}, 'boom', { enumerable: true, get: () => { throw new Error('no') } })
    expect(toSerializable(hostile)).toEqual({ boom: '[unreadable]' })
    vi.restoreAllMocks()
  })
})
