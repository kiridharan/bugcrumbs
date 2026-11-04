import { describe, expect, it, vi } from 'vitest'
import { createBugcrumbs, isEnabled, redact, REDACTED, RingBuffer } from './index'

describe('RingBuffer (FR-08)', () => {
  it('drops the oldest entry when full', () => {
    const buffer = new RingBuffer<number>(2)
    buffer.push(1)
    buffer.push(2)
    buffer.push(3)
    expect(buffer.toArray()).toEqual([2, 3])
  })
})

describe('redact (FR-21)', () => {
  it('redacts sensitive keys at any depth', () => {
    const out = redact({
      headers: { Authorization: 'Bearer abc', 'content-type': 'json' },
      body: { user: { password: 'hunter2', name: 'Ada' }, apiKey: 'k' },
    })
    expect(out.headers.Authorization).toBe(REDACTED)
    expect(out.headers['content-type']).toBe('json')
    expect(out.body.user.password).toBe(REDACTED)
    expect(out.body.user.name).toBe('Ada')
    expect(out.body.apiKey).toBe(REDACTED)
  })

  it('does not over-match ordinary keys', () => {
    const out = redact({ footprint: 1, successCount: 2, accessLevel: 'admin', otpCode: '123' })
    expect(out).toEqual({ footprint: 1, successCount: 2, accessLevel: 'admin', otpCode: REDACTED })
  })

  it('redacts card fields in any common naming style', () => {
    const keys = ['card[number]', 'card[cvc]', 'creditCardNumber', 'card_cvc', 'cardCvc', 'cvv2', 'securityCode', 'cc_no']
    const out = redact(Object.fromEntries(keys.map((key) => [key, '4242'])))
    expect(Object.values(out)).toEqual(keys.map(() => REDACTED))
  })

  it('redacts secrets inside strings', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl'
    const out = redact({
      message: `GET /api/me?access_token=abc&page=2 failed`,
      header: 'Authorization: Bearer abc.def-123',
      error: `invalid token ${jwt}`,
      plain: 'Order total is 12.50',
      log: 'retrying with token=abc, page=2 (session=xyz)',
    })
    expect(out).toEqual({
      log: `retrying with token=${encodeURIComponent(REDACTED)}, page=2 (session=${encodeURIComponent(REDACTED)})`,
      message: `GET /api/me?access_token=${encodeURIComponent(REDACTED)}&page=2 failed`,
      header: `Authorization: Bearer ${REDACTED}`,
      error: `invalid token ${REDACTED}`,
      plain: 'Order total is 12.50',
    })
  })

  it('handles circular references', () => {
    const a: Record<string, unknown> = {}
    a.self = a
    expect(redact(a).self).toBe('[circular]')
  })
})

describe('isEnabled (FR-23)', () => {
  it('is off by default', () => {
    expect(isEnabled()).toBe(false)
  })

  it('accepts the env-flag string', () => {
    expect(isEnabled({ enabled: 'true' })).toBe(true)
  })
})

describe('createBugcrumbs', () => {
  it('redacts entries before storing them', () => {
    const bc = createBugcrumbs()
    bc.push({ kind: 'state', source: 'test', label: 'q', status: 'error', data: { token: 'x' } })
    const [entry] = bc.getEntries()
    expect(entry?.kind === 'state' && entry.data).toEqual({ token: REDACTED })
  })

  it('returns a stable snapshot until entries change', () => {
    const bc = createBugcrumbs()
    const first = bc.getEntries()
    expect(bc.getEntries()).toBe(first)
    bc.mark('a')
    expect(bc.getEntries()).not.toBe(first)
  })

  it('notifies subscribers asynchronously and batched', async () => {
    const bc = createBugcrumbs()
    const listener = vi.fn()
    bc.subscribe(listener)
    bc.mark('a')
    bc.mark('b')
    expect(listener).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('runs plugin teardown and survives a throwing plugin', () => {
    const bc = createBugcrumbs()
    const teardown = vi.fn()
    const remove = bc.use({ name: 'ok', setup: () => teardown })
    expect(() => bc.use({ name: 'bad', setup: () => { throw new Error('boom') } })).not.toThrow()
    remove()
    expect(teardown).toHaveBeenCalledOnce()
  })
})
