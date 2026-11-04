import { getBugcrumbs, isSensitiveField, untracked, WIDGET_SELECTOR } from '@bugcrumbs/core'

export interface ScreenshotOptions {
  /** Element to capture in full. Default: the visible part of the page (the viewport). */
  target?: Element
  /** Pixel ratio of the output image. Default: 1, which keeps reports small. */
  scale?: number
  /** Give up on slow images and fonts after this long. Default: 10,000 ms. */
  timeout?: number
  /** Key patterns for fields to mask. Default: the shared instance's redaction keys. */
  redactKeys?: RegExp[]
}

export interface Screenshot {
  /** PNG image. Kept as a Blob (not a data URL) so large pages don't sit in memory as base64. */
  blob: Blob
  /** Size of the image in pixels. */
  width: number
  height: number
  /**
   * DOM screenshots are re-rendered from the page's HTML and CSS, so cross-origin images,
   * canvas, video and some CSS may be missing or differ. Always true; shown to readers.
   */
  approximate: true
}

/** Largest canvas side; browsers fail silently above ~16k, and huge PNGs bloat reports. */
const MAX_CANVAS_SIZE = 8192
const MASK = '••••••••'

/**
 * Canvases are copied with toDataURL(). When that fails, modern-screenshot falls back to calling
 * getContext('2d') on the live canvas, which can lock a WebGL canvas into 2D mode or throw for
 * canvases transferred to a worker. Leave such canvases out instead.
 */
function isSafeCanvas(canvas: HTMLCanvasElement): boolean {
  if (canvas.width === 0 || canvas.height === 0) return false
  try {
    return canvas.toDataURL() !== 'data:,'
  } catch {
    return false
  }
}

function keepNode(node: Node): boolean {
  if (!(node instanceof Element)) return true
  if (node.matches(WIDGET_SELECTOR)) return false
  // Re-loading a video for its first frame has no timeout and downloads it again.
  if (node instanceof HTMLVideoElement) return false
  if (node instanceof HTMLCanvasElement) return isSafeCanvas(node)
  return true
}

/**
 * The viewport is framed by translating the cloned <html>, which makes it the containing block
 * for `position: fixed` descendants. Their computed px offsets (copied onto the clone) are
 * relative to the viewport, so shift them by the scroll position to keep them where the tester saw them.
 */
function pinFixed(clone: Node, scrollX: number, scrollY: number): void {
  if (!(clone instanceof HTMLElement) || clone.style.position !== 'fixed') return
  const shift = (side: 'top' | 'left' | 'bottom' | 'right', by: number) => {
    const value = clone.style.getPropertyValue(side)
    if (value.endsWith('px')) clone.style.setProperty(side, `${parseFloat(value) + by}px`)
  }
  shift('top', scrollY)
  shift('bottom', -scrollY)
  shift('left', scrollX)
  shift('right', -scrollX)
}

/** Masks sensitive field values in the clone; the live page is never touched (FR-21). */
function maskClone(clone: Node, keys: RegExp[] | undefined): void {
  if (!(clone instanceof Element) || !/^(INPUT|TEXTAREA|SELECT)$/i.test(clone.tagName)) return
  if (!isSensitiveField(clone, keys)) return
  if (clone.tagName === 'SELECT') {
    clone.replaceChildren()
    return
  }
  // A fixed-length mask, so the image doesn't reveal the value's length either.
  clone.setAttribute('value', MASK)
  if (clone.tagName === 'TEXTAREA') clone.textContent = MASK
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Screenshot timed out after ${ms} ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // toBlob encodes off the main thread, unlike toDataURL.
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the screenshot'))), 'image/png')
  })
}

/**
 * Captures a DOM screenshot that excludes the Bugcrumbs widget and masks sensitive fields (FR-09).
 * The rendering library is loaded on first use, so it never adds to the app's initial bundle.
 */
export async function takeScreenshot(options: ScreenshotOptions = {}): Promise<Screenshot> {
  const { createContext, destroyContext, domToCanvas } = await import('modern-screenshot')
  const keys = options.redactKeys ?? getBugcrumbs().redactOptions.keys
  const timeout = options.timeout ?? 10_000
  const viewport = !options.target
  const { scrollX, scrollY } = window

  const context = await createContext(options.target ?? document.documentElement, {
    scale: options.scale ?? 1,
    timeout,
    maximumCanvasSize: MAX_CANVAS_SIZE,
    ...(viewport && {
      width: window.innerWidth,
      height: window.innerHeight,
      // Shift the cloned page so the area the tester is looking at lands in the frame.
      style: { transform: `translate(${-scrollX}px, ${-scrollY}px)` },
    }),
    filter: keepNode,
    onCloneEachNode: (clone) => {
      maskClone(clone, keys)
      if (viewport && (scrollX || scrollY)) pinFixed(clone, scrollX, scrollY)
    },
    // The page's own images and fonts are re-fetched (from cache) to inline them; keep those
    // requests out of the tester's network log.
    fetch: { requestInit: untracked({ cache: 'force-cache' }) },
  })
  try {
    const canvas = await withTimeout(domToCanvas(context), timeout + 5000)
    const blob = await canvasToBlob(canvas)
    return { blob, width: canvas.width, height: canvas.height, approximate: true }
  } finally {
    // Removes the hidden helper iframe the library adds to the page, even when capture fails.
    destroyContext(context)
  }
}
