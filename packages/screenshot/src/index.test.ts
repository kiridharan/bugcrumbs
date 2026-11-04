import { afterEach, describe, expect, it, vi } from 'vitest'
import { untracked } from '@bugcrumbs/core'
import { takeScreenshot } from './index'

const canvas = { width: 800, height: 600, toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['png'])) }
const context = { id: 'ctx' }
const createContext = vi.fn(async (_node: Node, _options?: Record<string, unknown>) => context)
const domToCanvas = vi.fn(async (_context: unknown): Promise<unknown> => canvas)
const destroyContext = vi.fn()
vi.mock('modern-screenshot', () => ({ createContext, domToCanvas, destroyContext }))

const optionsOfLastCall = () => createContext.mock.calls.at(-1)![1] as {
  filter: (node: Node) => boolean
  onCloneEachNode: (node: Node) => void
  fetch: { requestInit: RequestInit }
  width?: number
  style?: Record<string, string>
}

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('takeScreenshot (FR-09)', () => {
  it('captures the viewport as a PNG blob with its real size, without logging its own requests', async () => {
    const shot = await takeScreenshot()

    expect(shot).toMatchObject({ width: 800, height: 600, approximate: true })
    expect(shot.blob).toBeInstanceOf(Blob)
    expect(createContext.mock.calls[0]![0]).toBe(document.documentElement)
    const options = optionsOfLastCall()
    expect(options.width).toBe(window.innerWidth)
    expect(options.style?.transform).toBe(`translate(${-window.scrollX}px, ${-window.scrollY}px)`)
    expect(options.fetch.requestInit).toEqual(untracked({ cache: 'force-cache' }))
    expect(destroyContext).toHaveBeenCalledWith(context)
  })

  it('leaves out the widget, videos and canvases it cannot copy safely', async () => {
    document.body.innerHTML = `<main id="app">App</main><div data-bugcrumbs-widget></div><video></video><canvas id="empty" width="0"></canvas>`
    await takeScreenshot()
    const { filter } = optionsOfLastCall()
    expect(filter(document.querySelector('#app')!)).toBe(true)
    expect(filter(document.createTextNode('text'))).toBe(true)
    expect(filter(document.querySelector('[data-bugcrumbs-widget]')!)).toBe(false)
    expect(filter(document.querySelector('video')!)).toBe(false)
    expect(filter(document.querySelector('#empty')!)).toBe(false)
  })

  it('masks sensitive fields in the clone only', async () => {
    document.body.innerHTML = `
      <input id="card" autocomplete="cc-number" value="4242424242424242">
      <input id="otp" name="otp" value="123456">
      <textarea name="api_key">sk_live_123</textarea>
      <input id="email" name="email" value="ada@example.com">`
    await takeScreenshot()
    const { onCloneEachNode } = optionsOfLastCall()
    const clones = [...document.body.children].map((live) => {
      const clone = live.cloneNode(true) as HTMLElement
      clone.setAttribute('value', (live as HTMLInputElement).value)
      onCloneEachNode(clone)
      return clone
    })

    expect(clones.map((clone) => clone.getAttribute('value'))).toEqual(['••••••••', '••••••••', '••••••••', 'ada@example.com'])
    expect(clones[2]!.textContent).toBe('••••••••')
    expect(document.querySelector<HTMLInputElement>('#card')!.value).toBe('4242424242424242')
  })

  it('captures a chosen element in full', async () => {
    const target = document.createElement('section')
    await takeScreenshot({ target, scale: 2 })
    expect(createContext).toHaveBeenLastCalledWith(target, expect.objectContaining({ scale: 2 }))
    expect(optionsOfLastCall().width).toBeUndefined()
  })

  it('cleans up and rejects when capture fails or hangs', async () => {
    domToCanvas.mockRejectedValueOnce(new Error('boom'))
    await expect(takeScreenshot()).rejects.toThrow('boom')
    expect(destroyContext).toHaveBeenCalledTimes(1)

    vi.useFakeTimers()
    domToCanvas.mockReturnValueOnce(new Promise(() => {}))
    const pending = takeScreenshot({ timeout: 100 })
    const assertion = expect(pending).rejects.toThrow('Screenshot timed out after 5100 ms')
    await vi.advanceTimersByTimeAsync(5100)
    await assertion
    expect(destroyContext).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})

describe('fixed elements when scrolled', () => {
  it('keeps them where the tester saw them', async () => {
    window.scrollTo = () => {}
    Object.defineProperty(window, 'scrollY', { value: 500, configurable: true })
    await takeScreenshot()
    const header = document.createElement('div')
    header.style.cssText = 'position: fixed; top: 0px; left: 0px; right: 0px'
    const toast = document.createElement('div')
    toast.style.cssText = 'position: fixed; bottom: 16px; left: 16px'
    const plain = document.createElement('div')
    plain.style.cssText = 'position: absolute; top: 10px'
    const { onCloneEachNode } = optionsOfLastCall()
    ;[header, toast, plain].forEach((node) => onCloneEachNode(node))

    expect(header.style.top).toBe('500px')
    expect(toast.style.bottom).toBe('-484px')
    expect(plain.style.top).toBe('10px')
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
  })
})
