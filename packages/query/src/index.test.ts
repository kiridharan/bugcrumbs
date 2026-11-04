import { afterEach, describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/query-core'
import { createBugcrumbs, REDACTED, startCapture } from '@bugcrumbs/core'
import { trackQueryClient } from './index'

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const stops: Array<() => void> = []
afterEach(() => stops.splice(0).forEach((stop) => stop()))

/** An instance with capture running, as it is when Bugcrumbs is enabled. */
function enabledInstance() {
  const instance = createBugcrumbs()
  stops.push(startCapture({ enabled: true, network: false, console: false, steps: false }, instance))
  return instance
}

const failQuery = (client: QueryClient, queryKey: unknown[]) =>
  client.fetchQuery({ queryKey, queryFn: () => Promise.reject(new Error('500')) }).catch(() => {})

describe('trackQueryClient (FR-07)', () => {
  it('records a failed query with its key', async () => {
    const instance = enabledInstance()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    trackQueryClient(client, { instance })

    await client.fetchQuery({ queryKey: ['todos', 1], queryFn: () => Promise.reject(new Error('500')) }).catch(() => {})
    await settle()

    const [entry] = instance.getEntries()
    expect(entry).toMatchObject({
      kind: 'state',
      label: 'query ["todos",1]',
      status: 'error',
      error: '500',
      data: { queryKey: ['todos', 1], failureCount: 1, hasData: false, observers: 0 },
    })
  })

  it('redacts mutation variables and stops after uninstall', async () => {
    const instance = enabledInstance()
    const client = new QueryClient()
    const stop = trackQueryClient(client, { instance })
    const run = (password: string) =>
      client
        .getMutationCache()
        .build(client, { mutationKey: ['login'], mutationFn: () => Promise.reject(new Error('401')) })
        .execute({ password })
        .catch(() => {})

    await run('hunter2')
    expect(instance.getEntries()[0]).toMatchObject({ data: { variables: { password: REDACTED } } })

    stop()
    await run('again')
    expect(instance.getEntries()).toHaveLength(1)
  })

  it('redacts secrets in query keys, including the label', async () => {
    const instance = enabledInstance()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    trackQueryClient(client, { instance })

    await failQuery(client, ['me', { token: 'abc123', page: 2 }])
    await settle()

    const entry = instance.getEntries()[0]
    expect(JSON.stringify(entry)).not.toContain('abc123')
    expect(entry).toMatchObject({ label: `query ["me",{"token":"${REDACTED}","page":2}]` })
  })

  it('bounds large keys', async () => {
    const instance = enabledInstance()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    trackQueryClient(client, { instance })

    await failQuery(client, ['rows', Array.from({ length: 5000 }, (_, i) => ({ id: i }))])
    await settle()

    const entry = instance.getEntries()[0]
    expect(entry?.kind === 'state' && entry.label.length).toBeLessThan(200)
    expect(JSON.stringify(entry).length).toBeLessThan(10_000)
  })

  it('records nothing when Bugcrumbs is not enabled (FR-23)', async () => {
    const instance = createBugcrumbs()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    trackQueryClient(client, { instance })
    await failQuery(client, ['todos'])
    await settle()
    expect(instance.getEntries()).toHaveLength(0)
  })
})
