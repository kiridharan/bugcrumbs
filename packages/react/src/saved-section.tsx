import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { reportFileName, toCSV, toHTML, type Report } from '@bugcrumbs/core'
import { describeError, download } from './clipboard'
import { memoryStore, openSavedReports, type SavedReport, type SavedReportStore } from './saved'
import { button, colors, primaryButton } from './styles'

export interface SavedReports {
  items: SavedReport[]
  persistent: boolean
  save: (report: Report) => Promise<void>
  remove: (id: string) => Promise<void>
  clear: () => Promise<void>
}

/** Opens browser storage only when saved reports are enabled. */
export function useSavedReports(enabled = true): SavedReports {
  const store = useRef<SavedReportStore | undefined>(undefined)
  const [items, setItems] = useState<SavedReport[]>([])
  const [persistent, setPersistent] = useState(false)

  const refresh = useCallback(async () => {
    const list = await store.current!.list()
    setItems(list)
  }, [])

  useEffect(() => {
    if (!enabled) return
    store.current ??= openSavedReports()
    store.current.list().then(
      (list) => {
        setItems(list)
        setPersistent(store.current!.persistent)
      },
      // e.g. IndexedDB is blocked in this private window: keep saved reports for this page only.
      () => {
        store.current = memoryStore()
        setPersistent(false)
      },
    )
  }, [enabled])

  return {
    items,
    persistent,
    save: async (report) => {
      await store.current!.add(report)
      await refresh()
    },
    remove: async (id) => {
      await store.current!.remove(id)
      await refresh()
    },
    clear: async () => {
      await store.current!.clear()
      await refresh()
    },
  }
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')

/** Saved bugs, exported all at once (CSV for Excel and Jira import, or JSON). */
export function SavedSection({ saved, announce }: { saved: SavedReports; announce: (message: string) => void }): ReactNode {
  const [confirming, setConfirming] = useState(false)
  const { items } = saved
  if (!items.length) return null

  const run = (action: () => Promise<void> | void, done: string) => {
    Promise.resolve()
      .then(action)
      .then(
        () => announce(done),
        (error: unknown) => announce(`Something went wrong: ${describeError(error)}`),
      )
  }
  const reports = items.map((item) => item.report)
  const count = `${items.length} ${items.length === 1 ? 'bug' : 'bugs'}`

  return (
    <section aria-label="Saved bugs" style={{ marginTop: 12, borderTop: `1px solid ${colors.line}`, paddingTop: 10 }}>
      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          Saved bugs ({items.length})
        </summary>
        <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, maxHeight: 160, overflow: 'auto' }}>
          {items.map((item) => (
            <li key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 13 }}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.report.form.title}>
                {item.report.form.title}
                {item.report.form.severity && <span style={{ color: colors.muted }}> · {item.report.form.severity}</span>}
              </span>
              <button
                type="button"
                aria-label={`Download HTML report for ${item.report.form.title}`}
                onClick={() => {
                  const name = reportFileName(item.report, 'html')
                  run(() => download(name, toHTML(item.report), 'text/html'), `Downloaded ${name}`)
                }}
                style={{ ...button, padding: '2px 8px', fontSize: 12 }}
              >
                HTML
              </button>
              <button
                type="button"
                aria-label={`Delete ${item.report.form.title}`}
                onClick={() => run(() => saved.remove(item.id), `Deleted “${item.report.form.title}”`)}
                style={{ ...button, padding: '2px 8px', fontSize: 12 }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        {!saved.persistent && <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.muted }}>This browser blocks storage, so saved bugs are lost on reload.</p>}
      </details>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        <button
          type="button"
          onClick={() => run(() => download(`bugcrumbs-${stamp()}.csv`, toCSV(reports), 'text/csv'), `Exported ${count} as CSV — open it in Excel or import it into Jira`)}
          style={primaryButton}
        >
          Export {count} as CSV
        </button>
        <button
          type="button"
          onClick={() => run(() => download(`bugcrumbs-${stamp()}.json`, JSON.stringify(reports, null, 2), 'application/json'), `Exported ${count} as JSON`)}
          style={button}
        >
          JSON
        </button>
        {/* One button that asks for confirmation, so keyboard focus stays put. */}
        <button
          type="button"
          onClick={() => {
            if (!confirming) return setConfirming(true)
            setConfirming(false)
            run(saved.clear, 'Deleted all saved bugs')
          }}
          onBlur={() => setConfirming(false)}
          style={{ ...button, ...(confirming && { color: colors.fail, border: `1px solid ${colors.fail}` }) }}
        >
          {confirming ? 'Confirm delete all' : 'Delete all'}
        </button>
      </div>
    </section>
  )
}
