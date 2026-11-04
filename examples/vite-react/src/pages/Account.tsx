import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, type Me } from '../api'
import { useMe } from '../hooks'
import { Alert, Badge, Button, Field, Input, Modal, Select, Skeleton, useToast } from '../ui'

type Section = 'profile' | 'security' | 'api' | 'preferences' | 'danger'
const SECTIONS: { value: Section; label: string }[] = [
  { value: 'profile', label: 'Profile' },
  { value: 'security', label: 'Security' },
  { value: 'api', label: 'API keys' },
  { value: 'preferences', label: 'Preferences' },
  { value: 'danger', label: 'Delete account' },
]

function Profile({ me }: { me: Me }) {
  const client = useQueryClient()
  const toast = useToast()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationKey: ['me', 'update'],
    mutationFn: (body: Partial<Me>) => api<Me>('/api/me', { method: 'PATCH', body }),
    onSuccess: (next) => {
      client.setQueryData(['me'], next)
      setErrors({})
      toast('Profile saved', 'success')
    },
    onError: (error) => setErrors(error instanceof ApiError ? (error.body?.errors ?? {}) : {}),
  })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    save.mutate(Object.fromEntries(new FormData(event.currentTarget)) as Partial<Me>)
  }
  return (
    <form onSubmit={submit} className="card stack" aria-label="Profile">
      <div className="between">
        <h2>Profile</h2>
        <Badge tone="info">{me.plan} plan</Badge>
      </div>
      <div className="form-grid">
        <Field label="Full name" error={errors.name}>{(props) => <Input name="name" defaultValue={me.name} autoComplete="name" {...props} />}</Field>
        <Field label="Email" error={errors.email}>{(props) => <Input name="email" defaultValue={me.email} autoComplete="email" {...props} />}</Field>
        <div className="full">
          <Field label="Company" hint="Shown on invoices.">{(props) => <Input name="company" defaultValue={me.company} {...props} />}</Field>
        </div>
      </div>
      <div>
        <Button type="submit" variant="primary" loading={save.isPending}>
          Save changes
        </Button>
      </div>
    </form>
  )
}

function Security() {
  const [error, setError] = useState<string>()
  const change = useMutation({
    mutationKey: ['me', 'password'],
    mutationFn: (body: Record<string, string>) => api('/api/me/password', { method: 'POST', body }),
    onError: (err) => setError(err.message),
  })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(undefined)
    change.mutate(Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>)
  }
  return (
    <form onSubmit={submit} className="card stack" aria-label="Change password">
      <h2>Change password</h2>
      {error && <Alert title="Password not changed">{error}</Alert>}
      <Field label="Current password">{(props) => <Input name="currentPassword" type="password" autoComplete="current-password" {...props} />}</Field>
      <Field label="New password" hint="12+ characters, with a number.">{(props) => <Input name="newPassword" type="password" autoComplete="new-password" {...props} />}</Field>
      <div className="switch-row">
        <div>
          <strong>Two-factor authentication</strong>
          <div className="muted small">Protect your account with an authenticator app.</div>
        </div>
        <Badge tone="success">On</Badge>
      </div>
      <div>
        <Button type="submit" variant="primary" loading={change.isPending}>
          Update password
        </Button>
      </div>
    </form>
  )
}

function ApiKeys() {
  const toast = useToast()
  const reveal = useMutation({ mutationKey: ['me', 'api-key'], mutationFn: () => api<{ apiKey: string; createdAt: string }>('/api/me/api-key') })
  return (
    <section className="card stack" aria-label="API keys">
      <h2>API keys</h2>
      <p className="muted">Use this key to pull your order history into your own tools. Treat it like a password.</p>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <Input readOnly aria-label="Live API key" value={reveal.data?.apiKey ?? 'sk_live_••••••••••••••••••••'} style={{ fontFamily: 'ui-monospace, monospace' }} />
        {reveal.data ? (
          <Button onClick={() => navigator.clipboard?.writeText(reveal.data.apiKey).then(() => toast('API key copied', 'success'))}>Copy</Button>
        ) : (
          <Button loading={reveal.isPending} onClick={() => reveal.mutate()}>
            Reveal
          </Button>
        )}
      </div>
      <p className="muted small">Bugcrumbs should show this key as [redacted] in reports — check it in the Network section.</p>
    </section>
  )
}

function Preferences() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'system')
  const [prefs, setPrefs] = useState({ shipping: true, offers: false, digest: true })
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
  }, [theme])
  const rows: [keyof typeof prefs, string, string][] = [
    ['shipping', 'Shipping updates', 'Email me when an order ships or is delivered.'],
    ['offers', 'Offers and new arrivals', 'At most one email a week.'],
    ['digest', 'Monthly brewing digest', 'Recipes and guides from our roasters.'],
  ]
  return (
    <section className="card stack" aria-label="Preferences">
      <h2>Preferences</h2>
      <Field label="Theme">
        {(props) => (
          <Select value={theme} onChange={(event) => setTheme(event.target.value)} {...props} style={{ maxWidth: 240 }}>
            <option value="system">Match system</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
        )}
      </Field>
      <div>
        {rows.map(([key, title, hint]) => (
          <label key={key} className="switch-row" style={{ cursor: 'pointer' }}>
            <span>
              <strong>{title}</strong>
              <span className="muted small" style={{ display: 'block' }}>
                {hint}
              </span>
            </span>
            <span className="check">
              <input type="checkbox" checked={prefs[key]} onChange={(event) => setPrefs({ ...prefs, [key]: event.target.checked })} />
            </span>
          </label>
        ))}
      </div>
    </section>
  )
}

function DangerZone({ me }: { me: Me }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const toast = useToast()
  const close = useCallback(() => (setOpen(false), setTyped('')), [])
  return (
    <section className="card stack" aria-label="Delete account">
      <h2>Delete account</h2>
      <p className="muted">This permanently deletes your profile, order history and saved addresses. It can’t be undone.</p>
      <div>
        <Button variant="danger" onClick={() => setOpen(true)}>
          Delete my account…
        </Button>
      </div>
      <Modal
        open={open}
        title="Delete your account?"
        onClose={close}
        footer={
          <>
            <Button onClick={close}>Cancel</Button>
            <Button
              variant="danger"
              disabled={typed !== me.email}
              onClick={() => {
                close()
                toast('Demo only — your account is safe.', 'info')
              }}
            >
              Delete account
            </Button>
          </>
        }
      >
        <p className="muted">
          Type <strong>{me.email}</strong> to confirm. Tip: press Escape here with the Bugcrumbs panel open — only one of them should close.
        </p>
        <Input aria-label="Confirm email" value={typed} onChange={(event) => setTyped(event.target.value)} />
      </Modal>
    </section>
  )
}

export function AccountPage() {
  const me = useMe()
  const [section, setSection] = useState<Section>('profile')
  if (me.isPending) return <Skeleton height={320} />
  if (me.isError) return <Alert title="Couldn’t load your account">{me.error.message}</Alert>
  return (
    <>
      <div className="page-header">
        <h1>Account</h1>
      </div>
      <div className="account-layout">
        <nav className="side-tabs" role="tablist" aria-label="Account sections" aria-orientation="vertical">
          {SECTIONS.map((option) => (
            <button key={option.value} type="button" role="tab" className="tab" aria-selected={section === option.value} onClick={() => setSection(option.value)}>
              {option.label}
            </button>
          ))}
        </nav>
        <div role="tabpanel">
          {section === 'profile' && <Profile me={me.data} />}
          {section === 'security' && <Security />}
          {section === 'api' && <ApiKeys />}
          {section === 'preferences' && <Preferences />}
          {section === 'danger' && <DangerZone me={me.data} />}
        </div>
      </div>
    </>
  )
}
