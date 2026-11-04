import { describe, expect, it } from 'vitest'
import { createBugcrumbs } from '../bugcrumbs'
import { listenForErrors } from './errors'

describe('listenForErrors (FR-03)', () => {
  it('records uncaught errors, rejections and resource failures, and stops on uninstall', () => {
    const bc = createBugcrumbs()
    const stop = listenForErrors(bc)

    const error = new Error('render exploded')
    window.dispatchEvent(new ErrorEvent('error', { message: 'Uncaught Error: render exploded', error }))

    const rejection = Object.assign(new Event('unhandledrejection'), { reason: new Error('async failure') })
    window.dispatchEvent(rejection)

    const image = document.createElement('img')
    image.setAttribute('src', '/missing.png')
    document.body.append(image)
    image.dispatchEvent(new Event('error'))
    image.remove()

    expect(bc.getEntries()).toMatchObject([
      { kind: 'error', source: 'uncaught', message: 'Uncaught Error: render exploded', stack: error.stack },
      { kind: 'error', source: 'unhandledrejection', message: 'async failure' },
      { kind: 'error', source: 'resource', message: 'Failed to load <img> /missing.png' },
    ])

    stop()
    window.dispatchEvent(new ErrorEvent('error', { message: 'after stop' }))
    expect(bc.getEntries()).toHaveLength(3)
  })

  it('describes non-Error rejection reasons', () => {
    const bc = createBugcrumbs()
    const stop = listenForErrors(bc)
    window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: { code: 'E_TIMEOUT' } }))
    expect(bc.getEntries()[0]).toMatchObject({ message: '{"code":"E_TIMEOUT"}' })
    stop()
  })
})
