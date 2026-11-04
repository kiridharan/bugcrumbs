import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BugcrumbsLogo } from './logo'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const stubMotion = (reduce: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('reduce'),
    addEventListener() {},
    removeEventListener() {},
  }))

describe('BugcrumbsLogo', () => {
  it('animates with SVG elements, not a <style> tag (strict CSP)', () => {
    stubMotion(false)
    const { container } = render(<BugcrumbsLogo />)
    expect(container.querySelectorAll('animate, animateTransform').length).toBeGreaterThan(0)
    expect(container.querySelector('style')).toBeNull()
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
  })

  it('is static when the viewer prefers reduced motion', () => {
    stubMotion(true)
    const { container } = render(<BugcrumbsLogo />)
    expect(container.querySelectorAll('animate, animateTransform')).toHaveLength(0)
  })
})
