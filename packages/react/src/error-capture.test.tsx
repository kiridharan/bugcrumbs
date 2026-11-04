import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBugcrumbs, REDACTED, startCapture } from '@bugcrumbs/core'
import { BugcrumbsErrorBoundary, bugcrumbsRootOptions } from './error-capture'

function Boom(): never {
  throw new Error('render failed: token=abc')
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('React error capture (FR-04)', () => {
  it('keeps errors from the first mount until capture starts', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const instance = createBugcrumbs()
    render(
      <BugcrumbsErrorBoundary instance={instance} fallback={<p>Something broke</p>}>
        <Boom />
      </BugcrumbsErrorBoundary>,
    )
    expect(instance.getEntries()).toHaveLength(0)

    const stop = startCapture({ enabled: true, network: false, console: false, steps: false }, instance)
    await vi.waitFor(() => expect(instance.getEntries()).toHaveLength(1))
    expect(instance.getEntries()[0]).toMatchObject({
      kind: 'error',
      source: 'react',
      message: `render failed: token=${encodeURIComponent(REDACTED)}`,
      componentStack: expect.stringContaining('Boom'),
    })
    stop()
  })

  it('drops them if capture never starts, e.g. in production (FR-23)', async () => {
    vi.useFakeTimers()
    const instance = createBugcrumbs()
    bugcrumbsRootOptions({}, instance).onCaughtError(new Error('prod error'), {})
    await vi.advanceTimersByTimeAsync(10_000)

    const stop = startCapture({ enabled: true, network: false, console: false, steps: false }, instance)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(instance.getEntries()).toHaveLength(0)
    stop()
  })

  it('still calls the app’s own root error handlers', () => {
    const onUncaughtError = vi.fn()
    const options = bugcrumbsRootOptions({ onUncaughtError }, createBugcrumbs())
    const error = new Error('x')
    options.onUncaughtError(error, { componentStack: 'at App' })
    expect(onUncaughtError).toHaveBeenCalledWith(error, { componentStack: 'at App' })
  })
})
