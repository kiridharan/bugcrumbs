import { afterEach, describe, expect, it } from 'vitest'
import { createBugcrumbs } from '../bugcrumbs'
import { REDACTED } from '../redact'
import { recordSteps } from './steps'

const labels = (bc: ReturnType<typeof createBugcrumbs>) =>
  bc.getEntries().map((entry) => (entry.kind === 'step' ? `${entry.action}: ${entry.label}` : entry.kind))

afterEach(() => {
  document.body.innerHTML = ''
  history.replaceState(null, '', '/')
})

describe('recordSteps (FR-05)', () => {
  it('records clicks by accessible text, ignoring the widget', () => {
    document.body.innerHTML = `
      <button id="save"><span>Save   changes</span></button>
      <a href="#" aria-label="Open settings">⚙</a>
      <div data-bugcrumbs-widget><button id="bc">Bugcrumbs</button></div>`
    const bc = createBugcrumbs()
    const stop = recordSteps(bc)

    document.querySelector('span')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    document.querySelector('a')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    document.querySelector('#bc')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(labels(bc)).toEqual(['click: Clicked button "Save changes"', 'click: Clicked a "Open settings"'])
    stop()
  })

  it('records input changes and redacts sensitive fields', () => {
    document.body.innerHTML = `
      <label for="email">Email</label><input id="email" name="email">
      <input name="pw" type="password">
      <input name="card" autocomplete="cc-number">
      <input name="api_token" placeholder="Token">`
    const bc = createBugcrumbs()
    const stop = recordSteps(bc)
    const change = (selector: string, value: string) => {
      const input = document.querySelector<HTMLInputElement>(selector)!
      input.value = value
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }

    change('#email', 'ada@example.com')
    change('[name=pw]', 'hunter2')
    change('[name=card]', '4242424242424242')
    change('[name=api_token]', 'tok_123')

    expect(labels(bc)).toEqual([
      'input: Changed "Email" to "ada@example.com"',
      `input: Changed "pw" to "${REDACTED}"`,
      `input: Changed "card" to "${REDACTED}"`,
      `input: Changed "api_token" to "${REDACTED}"`,
    ])
    stop()
  })

  it('records route changes with sensitive params redacted, and restores history', () => {
    const { pushState } = history
    const bc = createBugcrumbs()
    const stop = recordSteps(bc)

    history.pushState(null, '', '/orders?token=abc&tab=open')
    history.replaceState(null, '', '/orders?token=abc&tab=open')
    history.pushState(null, '', '/orders/7')

    expect(labels(bc)).toEqual([
      `navigate: Navigated to /orders?token=${encodeURIComponent(REDACTED)}&tab=open`,
      'navigate: Navigated to /orders/7',
    ])
    stop()
    expect(history.pushState).toBe(pushState)
  })
})
