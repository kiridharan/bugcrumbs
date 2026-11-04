import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBugcrumbs, type BugcrumbsInstance } from '@bugcrumbs/core'
import { BugcrumbsDevtools, type BugcrumbsDevtoolsProps } from './index'

const takeScreenshot = vi.fn()
vi.mock('@bugcrumbs/screenshot', () => ({ takeScreenshot }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const PNG = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })

async function openPanel(instance: BugcrumbsInstance = createBugcrumbs(), props: Partial<BugcrumbsDevtoolsProps> = {}) {
  render(<BugcrumbsDevtools enabled instance={instance} {...props} />)
  fireEvent.click(screen.getByRole('button', { name: /^Bugcrumbs/ }))
  await screen.findByRole('dialog', { name: 'Report a bug' })
  return instance
}

function fillForm(title = 'Checkout fails', description = 'Nothing happens on click') {
  fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: title } })
  fireEvent.change(screen.getByLabelText(/^What happened/), { target: { value: description } })
}

const status = () => screen.getByRole('status').textContent

describe('BugcrumbsDevtools', () => {
  it('renders nothing when not enabled (FR-23)', () => {
    const { container } = render(<BugcrumbsDevtools instance={createBugcrumbs()} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows the failure count', async () => {
    const instance = createBugcrumbs()
    render(<BugcrumbsDevtools enabled instance={instance} />)
    await act(async () => {
      instance.push({ kind: 'error', source: 'uncaught', message: 'boom' })
      await Promise.resolve()
    })
    expect(screen.getByRole('button', { name: 'Bugcrumbs, 1 failures' })).toBeTruthy()
  })

  it('starts capture while mounted and stops it on unmount', () => {
    const before = console.info
    const { unmount } = render(<BugcrumbsDevtools enabled instance={createBugcrumbs()} />)
    expect(console.info).not.toBe(before)
    unmount()
    expect(console.info).toBe(before)
  })
})

describe('report panel (FR-13)', () => {
  it('loads lazily, focuses the title, and closes on Escape with focus returned', async () => {
    await openPanel()
    expect(document.activeElement).toBe(screen.getByLabelText(/^Title/))

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Bugcrumbs/ }))
  })

  it('keeps the draft when closed and keeps Escape away from the app', async () => {
    const appEscape = vi.fn()
    document.addEventListener('keydown', appEscape)
    await openPanel()
    fillForm('Half-written report')

    fireEvent.keyDown(screen.getByLabelText(/^Title/), { key: 'Escape', isComposing: true })
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(screen.getByLabelText(/^Title/), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(appEscape).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /^Bugcrumbs/ }))
    expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe('Half-written report')
    document.removeEventListener('keydown', appEscape)
  })

  it('lists captured problems', async () => {
    const instance = createBugcrumbs()
    instance.push({ kind: 'network', method: 'GET', url: '/api/cart', status: 503, durationMs: 9, failed: true })
    await openPanel(instance)
    expect(screen.getByText('GET /api/cart → 503 (9 ms)')).toBeTruthy()
  })

  it('asks for the required fields before exporting', async () => {
    await openPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Download HTML report' }))
    await vi.waitFor(() => expect(status()).toBe('Please fill in the title first.'))
    expect(screen.getByLabelText(/^Title/).getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(screen.getByLabelText(/^Title/))
  })
})

describe('exports (FR-14, FR-15)', () => {
  it('copies AI-shaped Markdown', async () => {
    const writeText = vi.fn(async (_text: string) => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await openPanel()
    fillForm()

    fireEvent.click(screen.getByRole('button', { name: 'Copy for AI' }))
    await vi.waitFor(() => expect(status()).toBe('Copied for AI — paste it into Claude, Cursor or Copilot'))
    const text = writeText.mock.calls[0]![0]
    expect(text).toMatch(/^I need help fixing a bug/)
    expect(text).toContain('# Checkout fails')
  })

  it('downloads a self-contained HTML report including the screenshot', async () => {
    takeScreenshot.mockResolvedValueOnce({ blob: PNG, width: 1, height: 1, approximate: true })
    const blobs: Blob[] = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob as Blob)
      return `blob:test/${blobs.length}`
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await openPanel()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Take screenshot' }))
    })
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: 'Download HTML report' }))

    await vi.waitFor(() => expect(status()).toMatch(/^Downloaded bugcrumbs-checkout-fails-.*\.html$/))
    expect(click).toHaveBeenCalledOnce()
    const html = await blobs.at(-1)!.text()
    expect(html).toContain('<h1>Checkout fails</h1>')
    expect(html).toContain('<img src="data:image/png;base64,iVBORw==')
  })
})

describe('screenshot (FR-09)', () => {
  it('shows the screenshot, moves focus sensibly, and revokes the preview URL', async () => {
    takeScreenshot.mockResolvedValueOnce({ blob: PNG, width: 1, height: 1, approximate: true })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test/shot')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    await openPanel()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Take screenshot' }))
    })
    expect(screen.getByRole('img', { name: 'Screenshot of the page' }).getAttribute('src')).toBe('blob:test/shot')
    expect(screen.getByText(/approximate/i)).toBeTruthy()
    expect(status()).toBe('Screenshot added')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Copy image' }))

    fireEvent.click(screen.getByRole('button', { name: 'Remove screenshot' }))
    expect(screen.queryByRole('img')).toBeNull()
    expect(revoke).toHaveBeenCalledWith('blob:test/shot')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Take screenshot' }))
  })

  it('reports a failed screenshot and lets the tester retry', async () => {
    takeScreenshot.mockRejectedValueOnce(new Error('canvas too large'))
    await openPanel()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Take screenshot' }))
    })
    expect(status()).toBe('Screenshot failed: canvas too large')
    expect(screen.getByRole('button', { name: 'Take screenshot' }).getAttribute('aria-disabled')).toBe('false')
  })
})

function mockClipboard() {
  const writeText = vi.fn(async (_text: string) => {})
  const write = vi.fn(async (_items: ClipboardItem[]) => {})
  Object.defineProperty(navigator, 'clipboard', { value: { writeText, write }, configurable: true })
  return { writeText, write }
}

function captureDownloads() {
  const blobs: Blob[] = []
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    blobs.push(blob as Blob)
    return `blob:test/${blobs.length}`
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  return blobs
}

describe('screenshot actions (FR-09)', () => {
  it('copies the image, downloads a PNG and retakes', async () => {
    takeScreenshot.mockResolvedValue({ blob: PNG, width: 1, height: 1, approximate: true })
    const { write } = mockClipboard()
    class FakeClipboardItem {
      constructor(readonly items: Record<string, Blob>) {}
    }
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)
    const blobs = captureDownloads()
    await openPanel()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Take screenshot' }))
    })

    fireEvent.click(screen.getByRole('button', { name: 'Copy image' }))
    await vi.waitFor(() => expect(status()).toBe('Screenshot copied — paste it into your ticket or chat'))
    expect((write.mock.calls[0]![0][0] as unknown as FakeClipboardItem).items['image/png']).toBe(PNG)

    fireEvent.click(screen.getByRole('button', { name: 'Download PNG' }))
    expect(blobs.at(-1)).toBe(PNG)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retake' }))
    })
    expect(takeScreenshot).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('img', { name: 'Screenshot of the page' })).toBeTruthy()
    vi.unstubAllGlobals()
    takeScreenshot.mockReset()
  })

  it('explains when the browser cannot copy images', async () => {
    takeScreenshot.mockResolvedValueOnce({ blob: PNG, width: 1, height: 1, approximate: true })
    vi.stubGlobal('ClipboardItem', undefined)
    captureDownloads()
    await openPanel()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Take screenshot' }))
    })
    fireEvent.click(screen.getByRole('button', { name: 'Copy image' }))
    await vi.waitFor(() => expect(status()).toMatch(/^Copy failed: this browser can’t copy images/))
    vi.unstubAllGlobals()
  })
})

describe('configurable panel', () => {
  it('shows only the configured actions, runs the first on Enter, and hides More when empty', async () => {
    const { writeText } = mockClipboard()
    await openPanel(createBugcrumbs(), { actions: ['copy-jira'], moreActions: [], savedReports: false })
    expect(screen.queryByRole('button', { name: 'Copy for AI' })).toBeNull()
    expect(screen.queryByText('More formats')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save and start next' })).toBeNull()

    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'Pay *fails*' } })
    fireEvent.submit(screen.getByLabelText(/^Title/).closest('form')!)
    await vi.waitFor(() => expect(status()).toMatch(/^Copied as Jira wiki markup/))
    expect(writeText.mock.calls[0]![0]).toContain('h3. Steps to reproduce')
  })

  it('needs only the title by default and offers a title from the latest failure', async () => {
    const { writeText } = mockClipboard()
    const instance = createBugcrumbs()
    instance.push({ kind: 'network', method: 'GET', url: 'http://x.test/api/cart', status: 503, durationMs: 9, failed: true })
    await openPanel(instance)
    fireEvent.click(screen.getByRole('button', { name: 'Use “GET /api/cart fails (503)”' }))
    expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe('GET /api/cart fails (503)')
    fireEvent.click(screen.getByRole('button', { name: 'Copy for AI' }))
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce())
    expect(writeText.mock.calls[0]![0]).not.toContain('## What happened')
  })

  it('applies field modes and custom fields, and passes them to custom actions', async () => {
    const run = vi.fn()
    await openPanel(createBugcrumbs(), {
      actions: [{ label: 'Send to webhook', run }],
      fields: {
        description: 'required',
        expected: 'hidden',
        severity: 'hidden',
        custom: [
          { id: 'build', label: 'Build number', required: true },
          { id: 'area', label: 'Area', type: 'select', options: ['Checkout', 'Search'] },
        ],
      },
    })
    expect(screen.queryByLabelText(/^Expected result/)).toBeNull()
    expect(screen.queryByLabelText('Severity')).toBeNull()

    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'Bug' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send to webhook' }))
    expect(status()).toBe('Please fill in what happened first.')
    expect(run).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/^What happened/), { target: { value: 'Broke' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send to webhook' }))
    expect(status()).toBe('Please fill in Build number first.')
    expect(document.activeElement).toBe(screen.getByLabelText(/^Build number/))

    fireEvent.change(screen.getByLabelText(/^Build number/), { target: { value: '1.4.2' } })
    fireEvent.change(screen.getByLabelText('Area'), { target: { value: 'Search' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send to webhook' }))
    await vi.waitFor(() => expect(status()).toBe('Send to webhook: done'))
    expect(run.mock.calls[0]![0].form).toMatchObject({
      title: 'Bug',
      description: 'Broke',
      extra: [
        { label: 'Build number', value: '1.4.2' },
        { label: 'Area', value: 'Search' },
      ],
    })
  })
})

describe('saved bugs', () => {
  it('saves a bug, starts fresh for the next one, and exports all as CSV', async () => {
    const blobs = captureDownloads()
    const instance = createBugcrumbs()
    instance.push({ kind: 'error', source: 'uncaught', message: 'first bug' })
    await openPanel(instance)

    fillForm('First bug')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save and start next' }))
    })
    await vi.waitFor(() => expect(status()).toBe('Saved “First bug”. Captured history cleared — ready for the next bug.'))
    expect(instance.getEntries()).toEqual([])
    expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe('')
    expect(document.activeElement).toBe(screen.getByLabelText(/^Title/))

    fillForm('Second, bug')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save and start next' }))
    })
    await vi.waitFor(() => expect(screen.getByText('Saved bugs (2)')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Export 2 bugs as CSV' }))
    await vi.waitFor(() => expect(status()).toMatch(/^Exported 2 bugs as CSV/))
    const csv = await blobs.at(-1)!.text()
    expect(csv).toContain('"First bug","Bug"')
    expect(csv).toContain('"Second, bug","Bug"')
    expect(csv).toContain('first bug')

    fireEvent.click(screen.getByRole('button', { name: 'Delete First bug' }))
    await vi.waitFor(() => expect(screen.getByText('Saved bugs (1)')).toBeTruthy())
    const deleteAll = screen.getByRole('button', { name: 'Delete all' })
    fireEvent.click(deleteAll)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete all' }))
    await vi.waitFor(() => expect(screen.queryByText(/^Saved bugs/)).toBeNull())
  })
})

describe('saved bugs storage', () => {
  it('never opens IndexedDB when savedReports is false', async () => {
    const open = vi.fn(() => {
      throw new Error('should not open')
    })
    vi.stubGlobal('indexedDB', { open })
    await openPanel(createBugcrumbs(), { savedReports: false })
    await act(async () => {})
    expect(open).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
