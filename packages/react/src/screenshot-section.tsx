import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Screenshot } from '@bugcrumbs/screenshot'
import { copyImage, describeError, download } from './clipboard'
import { button, colors } from './styles'

export type ScreenshotState =
  | { status: 'idle' }
  | { status: 'capturing' }
  | { status: 'done'; shot: Screenshot; url: string }
  | { status: 'error'; message: string }

export interface ScreenshotControls {
  state: ScreenshotState
  take: () => Promise<void>
  clear: (quiet?: boolean) => void
}

export function useScreenshot(announce: (message: string) => void): ScreenshotControls {
  const [state, setState] = useState<ScreenshotState>({ status: 'idle' })
  const mounted = useRef(true)
  const urlRef = useRef<string | undefined>(undefined)
  const capturing = useRef(false)

  const setUrl = (url: string | undefined) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = url
  }

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      setUrl(undefined)
    }
  }, [])

  const take = async () => {
    if (capturing.current) return
    capturing.current = true
    setState({ status: 'capturing' })
    announce('Taking screenshot…')
    try {
      // Loaded on demand so the screenshot code never ships in the app's initial bundle.
      const { takeScreenshot } = await import('@bugcrumbs/screenshot')
      const shot = await takeScreenshot()
      if (!mounted.current) return
      const url = URL.createObjectURL(shot.blob)
      setUrl(url)
      setState({ status: 'done', shot, url })
      announce('Screenshot added')
    } catch (error) {
      if (!mounted.current) return
      const message = describeError(error)
      setState({ status: 'error', message })
      announce(`Screenshot failed: ${message}`)
    } finally {
      capturing.current = false
    }
  }

  const clear = (quiet = false) => {
    setUrl(undefined)
    setState({ status: 'idle' })
    if (!quiet) announce('Screenshot removed')
  }

  return { state, take, clear }
}

const row = { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 } as const

/** Screenshot preview and actions (FR-09). */
export function ScreenshotSection({
  state,
  take,
  clear,
  announce,
}: ScreenshotControls & { announce: (message: string) => void }): ReactNode {
  const takeRef = useRef<HTMLButtonElement>(null)
  const copyRef = useRef<HTMLButtonElement>(null)
  const previous = useRef(state.status)

  // Keep keyboard focus inside the panel when the button it was on is replaced.
  useEffect(() => {
    const was = previous.current
    previous.current = state.status
    if (state.status === 'done' && was === 'capturing') copyRef.current?.focus()
    else if (state.status !== 'done' && was === 'done') takeRef.current?.focus()
  }, [state.status])

  const capturing = state.status === 'capturing'
  if (state.status !== 'done') {
    return (
      <section aria-label="Screenshot" style={{ marginTop: 12 }}>
        <button
          ref={takeRef}
          type="button"
          // aria-disabled instead of disabled, so focus isn't dropped while capturing.
          aria-disabled={capturing}
          onClick={() => void take()}
          style={{ ...button, opacity: capturing ? 0.7 : 1 }}
        >
          {capturing ? 'Taking screenshot…' : 'Take screenshot'}
        </button>
        {state.status === 'error' && <p style={{ color: colors.fail, margin: '4px 0 0' }}>Screenshot failed: {state.message}</p>}
      </section>
    )
  }

  const { shot, url } = state
  return (
    <section aria-label="Screenshot" style={{ marginTop: 12 }}>
      <figure style={{ margin: 0 }}>
        <a href={url} target="_blank" rel="noopener noreferrer" title="Open full size in a new tab">
          <img
            src={url}
            alt="Screenshot of the page"
            style={{ display: 'block', width: '100%', maxHeight: 220, objectFit: 'contain', objectPosition: 'left top', border: `1px solid ${colors.line}`, borderRadius: 6 }}
          />
        </a>
        <figcaption style={{ fontSize: 12, color: colors.muted, margin: '4px 0 0' }}>
          Approximate DOM screenshot; sensitive fields are masked. Click it to open full size.
        </figcaption>
      </figure>
      <div style={row}>
        <button
          ref={copyRef}
          type="button"
          onClick={() =>
            copyImage(shot.blob).then(
              () => announce('Screenshot copied — paste it into your ticket or chat'),
              (error: unknown) => announce(`Copy failed: ${describeError(error)}`),
            )
          }
          style={button}
        >
          Copy image
        </button>
        <button
          type="button"
          onClick={() => {
            download(`bugcrumbs-screenshot-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`, shot.blob, 'image/png')
            announce('Screenshot downloaded')
          }}
          style={button}
        >
          Download PNG
        </button>
        <button type="button" onClick={() => void take()} style={button}>
          Retake
        </button>
        <button type="button" onClick={() => clear()} style={button}>
          Remove screenshot
        </button>
      </div>
    </section>
  )
}
