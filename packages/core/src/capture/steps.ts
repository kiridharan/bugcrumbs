import type { BugcrumbsInstance } from '../bugcrumbs'
import { isSensitiveKey, REDACTED, redactUrl } from '../redact'
import { safely } from '../safe'
import { patchMethod } from './patch'
import { describeElement, truncate } from './serialize'

/** Elements inside this selector belong to the Bugcrumbs UI and are never recorded. */
export const WIDGET_SELECTOR = '[data-bugcrumbs-widget]'

const INTERACTIVE = 'a,button,input,select,textarea,label,summary,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="checkbox"],[onclick]'
const SENSITIVE_AUTOCOMPLETE = /cc-|one-time-code|current-password|new-password/i

function textOf(element: Element): string {
  const text = element.getAttribute('aria-label') ?? element.textContent ?? ''
  return truncate(text.replace(/\s+/g, ' ').trim(), 40)
}

function fieldName(element: Element): string {
  const labelText = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent : undefined
  const name =
    element.getAttribute('aria-label') ??
    labelText ??
    element.getAttribute('name') ??
    element.getAttribute('placeholder') ??
    describeElement(element)
  return truncate(name.replace(/\s+/g, ' ').trim(), 40)
}

/**
 * Whether a form field's value must never be stored or shown (FR-21). Uses attributes only,
 * so it also works on cloned nodes, e.g. inside a screenshot.
 */
export function isSensitiveField(element: Element, keys?: RegExp[]): boolean {
  return (
    element.getAttribute('type')?.toLowerCase() === 'password' ||
    SENSITIVE_AUTOCOMPLETE.test(element.getAttribute('autocomplete') ?? '') ||
    ['name', 'id'].some((attribute) => {
      const value = element.getAttribute(attribute)
      return !!value && isSensitiveKey(value, keys)
    })
  )
}

function currentPath(keys?: RegExp[]): string {
  return redactUrl(`${location.pathname}${location.search}${location.hash}`, keys)
}

/** Records clicks, input changes and route changes as repro steps (FR-05). */
export function recordSteps(api: BugcrumbsInstance): () => void {
  if (typeof document === 'undefined') return () => {}
  const keys = api.redactOptions.keys

  const onClick = (event: Event) =>
    safely(() => {
      const origin = event.target
      if (!(origin instanceof Element) || origin.closest(WIDGET_SELECTOR)) return
      const target = origin.closest(INTERACTIVE) ?? origin
      // Typing into a field is recorded on change, not on click.
      if (target instanceof HTMLInputElement && !['button', 'submit', 'reset', 'checkbox', 'radio'].includes(target.type)) return
      if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return
      const text = target instanceof HTMLInputElement ? fieldName(target) : textOf(target)
      api.push({ kind: 'step', action: 'click', label: `Clicked ${target.tagName.toLowerCase()}${text ? ` "${text}"` : ''}` })
    })

  const onChange = (event: Event) =>
    safely(() => {
      const target = event.target
      if (
        !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) ||
        target.closest(WIDGET_SELECTOR)
      ) {
        return
      }
      // Checkbox and radio clicks are already recorded as clicks.
      if (target instanceof HTMLInputElement && (target.type === 'checkbox' || target.type === 'radio')) return
      const value = isSensitiveField(target, keys) ? REDACTED : truncate(target.value, 50)
      api.push({ kind: 'step', action: 'input', label: `Changed "${fieldName(target)}" to "${value}"` })
    })

  let lastPath = currentPath(keys)
  const onNavigate = () =>
    safely(() => {
      const path = currentPath(keys)
      if (path === lastPath) return
      lastPath = path
      api.push({ kind: 'step', action: 'navigate', label: `Navigated to ${path}` })
    })

  const wrapHistory = (original: History['pushState']): History['pushState'] =>
    function (this: History, ...args: Parameters<History['pushState']>) {
      const result = original.apply(this, args)
      onNavigate()
      return result
    }

  document.addEventListener('click', onClick, true)
  document.addEventListener('change', onChange, true)
  window.addEventListener('popstate', onNavigate)
  window.addEventListener('hashchange', onNavigate)
  const restorePush = patchMethod(history, 'pushState', wrapHistory)
  const restoreReplace = patchMethod(history, 'replaceState', wrapHistory)

  return () => {
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('change', onChange, true)
    window.removeEventListener('popstate', onNavigate)
    window.removeEventListener('hashchange', onNavigate)
    restorePush()
    restoreReplace()
  }
}
