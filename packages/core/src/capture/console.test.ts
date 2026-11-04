import { describe, expect, it, vi } from 'vitest'
import { createBugcrumbs } from '../bugcrumbs'
import { REDACTED } from '../redact'
import { patchConsole } from './console'

describe('patchConsole (FR-02)', () => {
  it('records levels and arguments, calls through, and adds stacks to warn/error', () => {
    const original = vi.spyOn(console, 'error').mockImplementation(() => {})
    const bc = createBugcrumbs()
    const stop = patchConsole(bc)

    const failure = new Error('boom')
    console.error('Save failed', failure, { token: 't', id: 1 })
    console.log('hello')

    expect(original).toHaveBeenCalledWith('Save failed', failure, { token: 't', id: 1 })
    const [error, log] = bc.getEntries()
    expect(error).toMatchObject({
      kind: 'console',
      level: 'error',
      args: ['Save failed', { name: 'Error', message: 'boom' }, { token: REDACTED, id: 1 }],
    })
    expect(error?.kind === 'console' && error.stack).toBeTruthy()
    expect(log).toMatchObject({ level: 'log', args: ['hello'] })
    expect(log?.kind === 'console' && log.stack).toBeUndefined()

    stop()
    original.mockRestore()
  })

  it('serialises DOM nodes and circular objects instead of storing them', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const bc = createBugcrumbs()
    const stop = patchConsole(bc)
    const node = document.createElement('div')
    node.id = 'root'
    const circular: Record<string, unknown> = {}
    circular.self = circular

    console.log(node, circular)
    expect(bc.getEntries()[0]).toMatchObject({ args: ['<div#root>', { self: '[circular]' }] })
    stop()
    vi.restoreAllMocks()
  })

  it('restores console methods on uninstall', () => {
    const before = console.warn
    const stop = patchConsole(createBugcrumbs())
    expect(console.warn).not.toBe(before)
    stop()
    expect(console.warn).toBe(before)
  })
})
