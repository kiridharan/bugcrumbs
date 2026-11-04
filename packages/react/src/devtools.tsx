import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  getBugcrumbs,
  isEnabled,
  safelyWarn,
  startCapture,
  type BugcrumbsInstance,
  type CaptureOptions,
  type Entry,
} from '@bugcrumbs/core'
import { isFailure } from './failures'
import { BugcrumbsLogo } from './logo'
import type { PanelOptions } from './options'
import { colors, font } from './styles'

// The report panel (form, exporters, screenshot) loads only when a tester opens it.
const Panel = lazy(() => import('./panel'))

export interface BugcrumbsDevtoolsProps extends CaptureOptions, PanelOptions {
  instance?: BugcrumbsInstance
}

/** Server snapshot: the server never has entries, so hydration always starts from empty. */
const NO_ENTRIES: Entry[] = []
const getServerSnapshot = () => NO_ENTRIES

const PANEL_ID = 'bugcrumbs-panel'

const notice = { marginBottom: 8, padding: 12, background: colors.bg, border: `1px solid ${colors.line}`, borderRadius: 8 }

/**
 * Contains failures of the lazy panel (e.g. its chunk 404s after a redeploy) so they never reach
 * the host app's error handling or unmount its tree.
 */
class PanelBoundary extends Component<{ children: ReactNode; onRetry: () => void }, { failed: boolean }> {
  state: { failed: boolean } = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: unknown): void {
    safelyWarn('[bugcrumbs] The report panel failed to load', error)
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" style={notice}>
        Couldn’t load the Bugcrumbs report panel. Reload the page and try again.{' '}
        <button
          type="button"
          onClick={() => {
            this.setState({ failed: false })
            this.props.onRetry()
          }}
          style={{ font, color: colors.fg, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
        >
          Close
        </button>
      </div>
    )
  }
}

/**
 * Floating Bugcrumbs button. Renders nothing and captures nothing unless enabled (FR-23).
 * Starts capture on mount; call `startCapture()` before rendering to also catch the first requests.
 */
export function BugcrumbsDevtools({ instance, actions, moreActions, fields, savedReports, ...options }: BugcrumbsDevtoolsProps): ReactNode {
  if (!isEnabled(options)) return null
  return <Widget instance={instance ?? getBugcrumbs()} options={options} panel={{ actions, moreActions, fields, savedReports }} />
}

function Widget({ instance, options, panel }: { instance: BugcrumbsInstance; options: CaptureOptions; panel: PanelOptions }) {
  // Options are read once, like startCapture itself; changing them later has no effect.
  const [initialOptions] = useState(options)
  useEffect(() => startCapture(initialOptions, instance), [initialOptions, instance])
  const entries = useSyncExternalStore(instance.subscribe, instance.getEntries, getServerSnapshot)
  const [open, setOpen] = useState(false)
  // Once opened, the panel stays mounted (hidden when closed) so a draft survives closing it.
  const [mounted, setMounted] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const failures = entries.filter(isFailure).length

  const close = useCallback(() => {
    setOpen(false)
    toggleRef.current?.focus()
  }, [])

  return (
    <div
      data-bugcrumbs-widget=""
      style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 2147483647, font, color: colors.fg, textAlign: 'left' }}
    >
      {mounted && (
        <PanelBoundary
          onRetry={() => {
            setMounted(false)
            close()
          }}
        >
          <Suspense fallback={open ? <div style={notice}>Loading…</div> : null}>
            <Panel id={PANEL_ID} open={open} instance={instance} entries={entries} onClose={close} {...panel} />
          </Suspense>
        </PanelBoundary>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          ref={toggleRef}
          type="button"
          onClick={() => {
            setMounted(true)
            setOpen((value) => !value)
          }}
          aria-expanded={open}
          aria-controls={open ? PANEL_ID : undefined}
          aria-label={`Bugcrumbs, ${failures} failures`}
          title="Bugcrumbs"
          style={{
            position: 'relative',
            display: 'grid',
            placeItems: 'center',
            width: 44,
            height: 44,
            padding: 0,
            borderRadius: '50%',
            border: `2px solid ${failures > 0 ? colors.fail : 'transparent'}`,
            background: colors.dark,
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
            cursor: 'pointer',
            font,
          }}
        >
          <BugcrumbsLogo size={30} />
          {failures > 0 && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                minWidth: 20,
                height: 20,
                boxSizing: 'border-box',
                padding: '0 5px',
                borderRadius: 999,
                border: '2px solid #fff',
                background: colors.fail,
                color: '#fff',
                font: '600 11px/16px system-ui, sans-serif',
                textAlign: 'center',
              }}
            >
              {failures > 99 ? '99+' : failures}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
