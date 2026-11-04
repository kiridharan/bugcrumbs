import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react'

/**
 * A tiny router on history.pushState, so every page change shows up in Bugcrumbs' repro steps
 * (it records pushState and popstate). A real app would use React Router or TanStack Router.
 */
const EVENT = 'demo:navigate'

function subscribe(listener: () => void) {
  window.addEventListener('popstate', listener)
  window.addEventListener(EVENT, listener)
  return () => {
    window.removeEventListener('popstate', listener)
    window.removeEventListener(EVENT, listener)
  }
}

const getHref = () => location.pathname + location.search

export function navigate(to: string, { replace = false, scroll = true } = {}): void {
  if (to === getHref()) return
  if (replace) history.replaceState(null, '', to)
  else history.pushState(null, '', to)
  window.dispatchEvent(new Event(EVENT))
  if (scroll) window.scrollTo(0, 0)
}

export function useLocation(): { path: string; params: URLSearchParams } {
  const href = useSyncExternalStore(subscribe, getHref, () => '/')
  const url = new URL(href, 'http://local')
  return { path: url.pathname, params: url.searchParams }
}

/** Matches `/orders/:id` style patterns. */
export function matchPath(pattern: string, path: string): Record<string, string> | undefined {
  const want = pattern.split('/')
  const got = (path.length > 1 ? path.replace(/\/$/, '') : path).split('/')
  if (want.length !== got.length) return undefined
  const params: Record<string, string> = {}
  for (let i = 0; i < want.length; i++) {
    if (want[i]!.startsWith(':')) params[want[i]!.slice(1)] = decodeURIComponent(got[i]!)
    else if (want[i] !== got[i]) return undefined
  }
  return params
}

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string
  /** Mark as current when the path starts with `to` (for nav links). */
  activePrefix?: boolean
}

export function Link({ to, activePrefix, onClick, ...props }: LinkProps) {
  const { path } = useLocation()
  const current = activePrefix ? (to === '/' ? path === '/' : path.startsWith(to)) : undefined
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(to)
  }
  return <a href={to} onClick={handle} aria-current={current ? 'page' : undefined} {...props} />
}
