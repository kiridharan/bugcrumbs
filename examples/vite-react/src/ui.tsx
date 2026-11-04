import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import type { Category } from './api'

export function Button({
  variant = 'secondary',
  loading,
  size,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean; size?: 'sm' }) {
  return (
    <button type="button" className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className}`} aria-busy={loading || undefined} disabled={props.disabled || loading} {...props}>
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Skeleton({ height = 16, width = '100%' }: { height?: number; width?: number | string }) {
  return <span className="skeleton" style={{ height, width }} aria-hidden="true" />
}

export function Alert({ tone = 'danger', title, children, action }: { tone?: 'danger' | 'info' | 'success' | 'warning'; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <div>
        <strong>{title}</strong>
        {children && <div className="alert-body">{children}</div>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden="true">
        ☕
      </div>
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  )
}

export function Stars({ rating, count }: { rating: number; count?: number }) {
  const full = Math.round(rating)
  return (
    <span className="stars" aria-label={`${rating} out of 5 stars${count ? `, ${count} reviews` : ''}`}>
      <span aria-hidden="true">{'★'.repeat(full)}{'☆'.repeat(5 - full)}</span>
      {count !== undefined && <span className="muted" aria-hidden="true"> ({count})</span>}
    </span>
  )
}

/** Drawn product art, so the demo needs no images from other origins. */
export function ProductArt({ category, color, size = 'md' }: { category: Category; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const shapes: Record<Category, ReactNode> = {
    coffee: (
      <>
        <rect x="34" y="22" width="52" height="76" rx="8" fill={color} />
        <rect x="34" y="22" width="52" height="14" rx="6" fill="#0003" />
        <ellipse cx="60" cy="66" rx="10" ry="14" fill="#fff6" />
        <path d="M60 54v24" stroke={color} strokeWidth="3" />
      </>
    ),
    tea: (
      <>
        <rect x="30" y="34" width="60" height="58" rx="10" fill={color} />
        <rect x="42" y="22" width="36" height="16" rx="4" fill="#0003" />
        <path d="M48 62c8-12 16-12 24 0-8 12-16 12-24 0z" fill="#fff8" />
      </>
    ),
    brewing: (
      <>
        <path d="M30 92h60l-6-46H36z" fill={color} />
        <path d="M84 56c14 0 16 22 2 26" stroke={color} strokeWidth="6" fill="none" />
        <path d="M36 46c-10-4-14-12-14-18" stroke={color} strokeWidth="5" fill="none" />
        <rect x="46" y="36" width="28" height="10" rx="4" fill="#0003" />
      </>
    ),
    gear: (
      <>
        <rect x="32" y="28" width="56" height="64" rx="14" fill={color} />
        <circle cx="60" cy="60" r="16" fill="#fff3" />
        <circle cx="60" cy="60" r="6" fill="#fff8" />
      </>
    ),
  }
  return (
    <div className={`art art-${size}`} style={{ background: `color-mix(in srgb, ${color} 14%, var(--surface-2))` }}>
      <svg viewBox="0 0 120 120" role="img" aria-hidden="true">
        {shapes[category]}
      </svg>
    </div>
  )
}

export function QtyStepper({ value, onChange, min = 1, max = 99, label, disabled }: { value: number; onChange: (value: number) => void; min?: number; max?: number; label: string; disabled?: boolean }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label}`} disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label={`Increase ${label}`} disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  )
}

interface FieldProps {
  label: string
  error?: string
  hint?: string
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode
}

export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <span id={`${id}-error`} className="field-error">
          {error}
        </span>
      ) : (
        hint && (
          <span id={`${id}-hint`} className="field-hint">
            {hint}
          </span>
        )
      )}
    </div>
  )
}

export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => <input className="input" {...props} />
export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => <select className="input" {...props} />

export function Tabs<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" role="tab" aria-selected={option.value === value} className="tab" onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Modal dialog: focus moves in, Escape closes, focus returns to the opener. */
export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input, button, select, textarea')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

type Toast = { id: number; tone: 'success' | 'danger' | 'info'; message: string }
const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const next = useRef(1)
  const dismiss = (id: number) => setToasts((list) => list.filter((toast) => toast.id !== id))
  const show = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = next.current++
    setToasts((list) => [...list.slice(-3), { id, tone, message }])
    setTimeout(() => dismiss(id), 5000)
  }, [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <span>{toast.message}</span>
            <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(toast.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
