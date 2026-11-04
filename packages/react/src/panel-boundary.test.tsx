import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBugcrumbs } from '@bugcrumbs/core'
import { BugcrumbsDevtools } from './index'

// Simulates the lazy panel chunk failing to load, e.g. a 404 after a redeploy.
vi.mock('./panel', () => {
  throw new Error('Failed to fetch dynamically imported module')
})

afterEach(cleanup)

describe('panel loading failure', () => {
  it('is contained in the widget and never reaches the host app', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <div>
        <p>Host app</p>
        <BugcrumbsDevtools enabled instance={createBugcrumbs()} />
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: /^Bugcrumbs/ }))

    expect((await screen.findByRole('alert')).textContent).toContain('Couldn’t load the Bugcrumbs report panel')
    expect(screen.getByText('Host app')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('alert')).toBeNull()
    warn.mockRestore()
  })
})
