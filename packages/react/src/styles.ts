import type { CSSProperties } from 'react'

// Inline styles keep the widget free of global CSS that could clash with the host app.
// Colours meet WCAG 2.1 AA contrast on their backgrounds.
export const colors = {
  fg: '#111827',
  muted: '#4b5563',
  line: '#d1d5db',
  bg: '#ffffff',
  dark: '#1f2937',
  fail: '#b91c1c',
  focus: '#2563eb',
} as const

export const font = '14px/1.4 system-ui, -apple-system, Segoe UI, sans-serif'

export const button: CSSProperties = {
  padding: '6px 10px',
  borderRadius: 6,
  border: `1px solid ${colors.line}`,
  background: colors.bg,
  color: colors.fg,
  cursor: 'pointer',
  font,
}

export const primaryButton: CSSProperties = { ...button, background: colors.dark, borderColor: colors.dark, color: '#fff' }

export const field: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 4,
  padding: '6px 8px',
  border: `1px solid ${colors.muted}`,
  borderRadius: 6,
  font,
  color: colors.fg,
  background: colors.bg,
}
