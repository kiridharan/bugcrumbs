import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import {
  createReport,
  describeEntry,
  reportFileName,
  suggestTitle,
  toAIMarkdown,
  toHTML,
  toJiraMarkup,
  toJSON,
  toMarkdown,
  type BugcrumbsInstance,
  type Entry,
  type Report,
  type ReportForm,
} from '@bugcrumbs/core'
import { blobToDataUrl, copyText, describeError, download } from './clipboard'
import { isFailure } from './failures'
import { DEFAULT_ACTIONS, DEFAULT_MORE_ACTIONS, type BuiltInAction, type CustomField, type FieldMode, type PanelOptions, type ReportAction } from './options'
import { SavedSection, useSavedReports } from './saved-section'
import { ScreenshotSection, useScreenshot } from './screenshot-section'
import { button, colors, field, font, primaryButton } from './styles'

export interface PanelProps extends PanelOptions {
  id: string
  /** The panel stays mounted once opened, so closing it keeps the draft and screenshot. */
  open: boolean
  instance: BugcrumbsInstance
  entries: Entry[]
  onClose: () => void
}

type Severity = NonNullable<ReportForm['severity']>
const SEVERITIES: Severity[] = ['low', 'medium', 'high', 'critical']

interface Draft {
  title: string
  description: string
  expected: string
  severity: Severity | ''
  custom: Record<string, string>
}
const EMPTY_DRAFT: Draft = { title: '', description: '', expected: '', severity: '', custom: {} }

const COPY: Record<Extract<BuiltInAction, `copy-${string}`>, { label: string; render: (report: Report) => string; done: string }> = {
  'copy-ai': { label: 'Copy for AI', render: toAIMarkdown, done: 'Copied for AI — paste it into Claude, Cursor or Copilot' },
  'copy-markdown': { label: 'Copy Markdown', render: toMarkdown, done: 'Markdown copied — paste it into your ticket' },
  'copy-jira': { label: 'Copy for Jira', render: toJiraMarkup, done: 'Copied as Jira wiki markup — paste it into the issue description' },
}
const DOWNLOAD: Record<Extract<BuiltInAction, `download-${string}`>, { label: string; render: (report: Report) => string; extension: string; type: string }> = {
  'download-html': { label: 'Download HTML report', render: toHTML, extension: 'html', type: 'text/html' },
  'download-json': { label: 'Download JSON', render: toJSON, extension: 'json', type: 'application/json' },
  'download-markdown': { label: 'Download Markdown', render: toMarkdown, extension: 'md', type: 'text/markdown' },
}

const actionLabel = (action: ReportAction) => (typeof action === 'object' ? action.label : (COPY as Record<string, { label: string }>)[action]?.label ?? DOWNLOAD[action as keyof typeof DOWNLOAD].label)
const actionKey = (action: ReportAction, index: number) => (typeof action === 'object' ? `custom-${index}-${action.label}` : action)

/** A compact summary of what was captured, with the details one click away. */
function Captured({ entries }: { entries: Entry[] }) {
  const failures = entries.filter(isFailure)
  const steps = entries.filter((entry) => entry.kind === 'step')
  return (
    <section aria-label="Captured so far">
      <p style={{ margin: 0, color: failures.length ? colors.fail : colors.muted }}>
        {failures.length} {failures.length === 1 ? 'problem' : 'problems'} · {steps.length} steps · {entries.length} entries captured
      </p>
      {entries.length > 0 && (
        <details style={{ marginTop: 4, fontSize: 12 }}>
          <summary style={{ cursor: 'pointer', color: colors.muted }}>Show details</summary>
          {failures.length > 0 && (
            <ul style={{ margin: '4px 0 0', paddingLeft: 18, maxHeight: 120, overflow: 'auto' }}>
              {failures
                .slice(-50)
                .reverse()
                .map((entry) => (
                  <li key={entry.id} style={{ color: colors.fail, wordBreak: 'break-word' }}>
                    {describeEntry(entry).slice(0, 200)}
                  </li>
                ))}
            </ul>
          )}
          {steps.length > 0 && (
            <>
              <p style={{ margin: '6px 0 0', color: colors.muted }}>Last steps</p>
              <ol start={Math.max(1, steps.length - 9)} style={{ margin: '2px 0 0', paddingLeft: 24, maxHeight: 120, overflow: 'auto' }}>
                {steps.slice(-10).map((step) => (
                  <li key={step.id} style={{ wordBreak: 'break-word' }}>
                    {describeEntry(step).slice(0, 140)}
                  </li>
                ))}
              </ol>
            </>
          )}
        </details>
      )}
    </section>
  )
}

/** The report form and export actions (FR-13, FR-14, FR-15). Loaded lazily by the widget. */
export default function Panel({ id, open, instance, entries, onClose, actions, moreActions, fields = {}, savedReports = true }: PanelProps): ReactNode {
  const headingId = useId()
  const fieldId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const refs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>>({})
  const [form, setForm] = useState<Draft>(EMPTY_DRAFT)
  const [invalid, setInvalid] = useState<Record<string, boolean>>({})
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const screenshot = useScreenshot(setStatus)
  const saved = useSavedReports(savedReports)

  const primary = actions ?? DEFAULT_ACTIONS
  const more = moreActions ?? DEFAULT_MORE_ACTIONS.filter((action) => !primary.includes(action))
  const mode = {
    description: fields.description ?? 'optional',
    expected: fields.expected ?? 'optional',
    severity: fields.severity ?? 'optional',
  } satisfies Record<string, FieldMode>
  const customFields = fields.custom ?? []
  const suggestion = suggestTitle(entries)

  useEffect(() => {
    if (open) refs.current.title?.focus()
  }, [open])

  const set = (key: Exclude<keyof Draft, 'custom'>) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const setCustom = (key: string) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, custom: { ...current.custom, [key]: event.target.value } }))

  /** Returns the form, or undefined after pointing the tester at the first missing field. */
  const validate = (): ReportForm | undefined => {
    const required: [string, string, string][] = [['title', 'the title', form.title]]
    if (mode.description === 'required') required.push(['description', 'what happened', form.description])
    if (mode.expected === 'required') required.push(['expected', 'the expected result', form.expected])
    for (const custom of customFields) if (custom.required) required.push([`custom:${custom.id}`, custom.label, form.custom[custom.id] ?? ''])
    const missing = required.filter(([, , value]) => !value.trim())
    setInvalid(Object.fromEntries(missing.map(([key]) => [key, true])))
    if (missing.length) {
      const [key, name] = missing[0]!
      refs.current[key]?.focus()
      setStatus(`Please fill in ${name} first.`)
      return undefined
    }
    const extra = customFields.map((custom) => ({ label: custom.label, value: (form.custom[custom.id] ?? '').trim() })).filter((entry) => entry.value)
    return {
      title: form.title.trim(),
      description: mode.description === 'hidden' ? '' : form.description.trim(),
      expected: (mode.expected !== 'hidden' && form.expected.trim()) || undefined,
      severity: (mode.severity !== 'hidden' && form.severity) || undefined,
      ...(extra.length && { extra }),
    }
  }

  const shotBlob = () => (screenshot.state.status === 'done' ? screenshot.state.shot.blob : undefined)

  /** Builds the full report, with the screenshot converted to a data URL only here. */
  const withScreenshot = async (reportForm: ReportForm) => {
    const blob = shotBlob()
    return createReport(instance, { form: reportForm, screenshot: blob ? await blobToDataUrl(blob) : undefined })
  }

  const runBusy = async (work: () => Promise<string>) => {
    if (busy) return
    setBusy(true)
    try {
      setStatus(await work())
    } catch (error) {
      setStatus(`Something went wrong: ${describeError(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const runAction = (action: ReportAction) => {
    if (busy) return
    const reportForm = validate()
    if (!reportForm) return

    if (typeof action === 'object') {
      // Built synchronously and run inside the click, so a custom action can use the clipboard.
      let result: void | Promise<void>
      try {
        result = action.run(createReport(instance, { form: reportForm }), { screenshot: shotBlob() })
      } catch (error) {
        setStatus(`${action.label} failed: ${describeError(error)}`)
        return
      }
      void runBusy(async () => {
        await result
        return `${action.label}: done`
      })
      return
    }

    if (action in COPY) {
      // Copies are built and written synchronously inside the click (see copyText).
      const copy = COPY[action as keyof typeof COPY]
      let text: string
      try {
        text = copy.render(createReport(instance, { form: reportForm }))
      } catch (error) {
        setStatus(`Something went wrong: ${describeError(error)}`)
        return
      }
      const note = shotBlob() ? ' (the screenshot is copied separately with Copy image)' : ''
      copyText(text, rootRef.current).then(
        () => setStatus(copy.done + note),
        (error: unknown) => setStatus(`Copy failed: ${describeError(error)}`),
      )
      return
    }

    const target = DOWNLOAD[action as keyof typeof DOWNLOAD]
    void runBusy(async () => {
      const report = await withScreenshot(reportForm)
      const name = reportFileName(report, target.extension)
      download(name, target.render(report), target.type)
      return `Downloaded ${name}`
    })
  }

  /** Saves this bug, then clears the form, screenshot and captured history for the next one. */
  const saveAndNext = () => {
    if (busy) return
    const reportForm = validate()
    if (!reportForm) return
    // Snapshot now, so entries captured while saving stay for the next bug instead of being lost.
    const report = createReport(instance, { form: reportForm })
    const blob = shotBlob()
    void runBusy(async () => {
      await saved.save(blob ? { ...report, screenshot: await blobToDataUrl(blob) } : report)
      setForm((current) => ({ ...EMPTY_DRAFT, severity: current.severity }))
      setInvalid({})
      screenshot.clear(true)
      const last = report.entries.at(-1)
      if (last) instance.clear(last.id)
      refs.current.title?.focus()
      return `Saved “${reportForm.title}”. Captured history cleared — ready for the next bug.`
    })
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (primary[0]) runAction(primary[0])
    else if (savedReports) saveAndNext()
  }

  const busyStyle: CSSProperties = busy ? { opacity: 0.6, cursor: 'progress' } : {}
  const label = (text: string, required = false) => (
    <span>
      {text}
      {required && <span aria-hidden="true"> *</span>}
    </span>
  )
  const fieldStyle = (key: string): CSSProperties => ({ ...field, borderColor: invalid[key] ? colors.fail : colors.muted })
  const register = (key: string) => (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null) => {
    refs.current[key] = element
  }

  const textField = (key: 'description' | 'expected', text: string, rows: number) =>
    mode[key] === 'hidden' ? null : (
      <>
        <label htmlFor={`${fieldId}-${key}`} style={{ display: 'block', marginTop: 8 }}>
          {label(text, mode[key] === 'required')}
        </label>
        <textarea
          ref={register(key)}
          id={`${fieldId}-${key}`}
          value={form[key]}
          onChange={set(key)}
          required={mode[key] === 'required'}
          rows={rows}
          aria-invalid={invalid[key] || undefined}
          style={{ ...fieldStyle(key), resize: 'vertical' }}
        />
      </>
    )

  const customField = (custom: CustomField) => {
    const key = `custom:${custom.id}`
    const props = {
      id: `${fieldId}-${key}`,
      value: form.custom[custom.id] ?? '',
      onChange: setCustom(custom.id),
      required: custom.required,
      'aria-invalid': invalid[key] || undefined,
      style: fieldStyle(key),
    }
    return (
      <div key={custom.id}>
        <label htmlFor={props.id} style={{ display: 'block', marginTop: 8 }}>
          {label(custom.label, custom.required)}
        </label>
        {custom.type === 'textarea' ? (
          <textarea ref={register(key)} rows={2} {...props} style={{ ...props.style, resize: 'vertical' }} />
        ) : custom.type === 'select' ? (
          <select ref={register(key)} {...props}>
            <option value="">Not set</option>
            {(custom.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input ref={register(key)} {...props} />
        )}
      </div>
    )
  }

  const actionButton = (action: ReportAction, index: number, isPrimary: boolean) => {
    const isDownload = typeof action === 'object' || !(action in COPY)
    const style = { ...(isPrimary ? primaryButton : button), ...(isDownload ? busyStyle : {}) }
    return (
      <button
        key={actionKey(action, index)}
        type={isPrimary && index === 0 ? 'submit' : 'button'}
        aria-disabled={isDownload ? busy : undefined}
        onClick={isPrimary && index === 0 ? undefined : () => runAction(action)}
        style={style}
      >
        {actionLabel(action)}
      </button>
    )
  }

  return (
    <div
      ref={rootRef}
      id={id}
      role="dialog"
      aria-labelledby={headingId}
      hidden={!open}
      onKeyDown={(event) => {
        // Ignore Escape that ends IME composition, and keep it from reaching the app's own
        // Escape handlers (which could close the very dialog being reported).
        if (event.key !== 'Escape' || event.nativeEvent.isComposing) return
        event.stopPropagation()
        onClose()
      }}
      style={{
        // Inline too, in case host CSS overrides the [hidden] attribute.
        display: open ? 'block' : 'none',
        marginBottom: 8,
        width: 'min(400px, calc(100vw - 32px))',
        maxHeight: 'min(680px, calc(100vh - 96px))',
        overflow: 'auto',
        background: colors.bg,
        color: colors.fg,
        border: `1px solid ${colors.line}`,
        borderRadius: 10,
        padding: 14,
        boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
        font,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 id={headingId} style={{ margin: 0, fontSize: 16 }}>
          Report a bug
        </h2>
        <button type="button" onClick={onClose} aria-label="Close Bugcrumbs" style={{ ...button, padding: '2px 8px' }}>
          ×
        </button>
      </div>

      <Captured entries={entries} />
      <ScreenshotSection {...screenshot} announce={setStatus} />

      <form onSubmit={onSubmit} noValidate style={{ marginTop: 12 }}>
        <label htmlFor={`${fieldId}-title`} style={{ display: 'block' }}>
          {label('Title', true)}
        </label>
        <input
          ref={register('title')}
          id={`${fieldId}-title`}
          value={form.title}
          onChange={set('title')}
          required
          aria-invalid={invalid.title || undefined}
          placeholder="Short summary"
          style={fieldStyle('title')}
        />
        {suggestion && !form.title && (
          <button
            type="button"
            onClick={() => {
              setForm((current) => ({ ...current, title: suggestion }))
              refs.current.title?.focus()
            }}
            style={{ font, fontSize: 12, color: colors.focus, background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', textAlign: 'left', textDecoration: 'underline' }}
          >
            Use “{suggestion}”
          </button>
        )}

        {textField('description', 'What happened', 3)}
        {textField('expected', 'Expected result', 2)}

        {mode.severity !== 'hidden' && (
          <>
            <label htmlFor={`${fieldId}-severity`} style={{ display: 'block', marginTop: 8 }}>
              Severity
            </label>
            <select id={`${fieldId}-severity`} value={form.severity} onChange={set('severity')} style={field}>
              <option value="">Not set</option>
              {SEVERITIES.map((severity) => (
                <option key={severity} value={severity}>
                  {severity[0]!.toUpperCase() + severity.slice(1)}
                </option>
              ))}
            </select>
          </>
        )}

        {customFields.map(customField)}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {primary.map((action, index) => actionButton(action, index, index === 0))}
          {savedReports && (
            <button type={primary.length ? 'button' : 'submit'} aria-disabled={busy} onClick={primary.length ? saveAndNext : undefined} style={{ ...button, ...busyStyle }}>
              Save and start next
            </button>
          )}
        </div>

        {more.length > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: 'pointer', color: colors.muted, fontSize: 13 }}>More formats</summary>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>{more.map((action, index) => actionButton(action, index, false))}</div>
          </details>
        )}
      </form>

      {savedReports && <SavedSection saved={saved} announce={setStatus} />}

      <p role="status" aria-live="polite" style={{ minHeight: 18, margin: '8px 0 0', fontSize: 12, color: colors.muted }}>
        {status}
      </p>
    </div>
  )
}
