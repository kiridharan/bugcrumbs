export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function download(fileName: string, content: string | Blob, type: string): void {
  const url = URL.createObjectURL(typeof content === 'string' ? new Blob([content], { type }) : content)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  // Detached link: the click is never seen by the repro-step recorder.
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Copies via a hidden textarea; for browsers without the async Clipboard API or permission. */
function copyWithTextarea(text: string, container: HTMLElement | null): void {
  const previousFocus = document.activeElement as HTMLElement | null
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  ;(container ?? document.body).append(textarea)
  try {
    textarea.select()
    if (!document.execCommand('copy')) throw new Error('Copy is blocked in this browser')
  } finally {
    textarea.remove()
    previousFocus?.focus()
  }
}

/**
 * Must be called synchronously from the click handler: Safari only allows clipboard writes
 * while the user gesture is still active, so nothing may be awaited before this.
 */
export function copyText(text: string, container: HTMLElement | null): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    try {
      copyWithTextarea(text, container)
      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error)
    }
  }
  return navigator.clipboard.writeText(text).catch(() => copyWithTextarea(text, container))
}

/** Copies a PNG so it can be pasted into a ticket or chat. Call synchronously from the click, as above. */
export function copyImage(png: Blob): Promise<void> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    return Promise.reject(new Error('this browser can’t copy images; use Download PNG instead'))
  }
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
}

export const describeError = (error: unknown): string => (error instanceof Error ? error.message : String(error))
