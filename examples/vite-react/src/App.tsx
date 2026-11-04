import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from './api'
import { useCart, useMe } from './hooks'
import { AccountPage } from './pages/Account'
import { CartPage } from './pages/Cart'
import { CheckoutPage } from './pages/Checkout'
import { DashboardPage } from './pages/Dashboard'
import { LabPage } from './pages/Lab'
import { NotFound } from './pages/NotFound'
import { OrderDetailPage, OrdersPage } from './pages/Orders'
import { ProductPage } from './pages/Product'
import { ShopPage } from './pages/Shop'
import { Link, matchPath, useLocation } from './router'
import { Button, useToast } from './ui'

const ROUTES: [string, (params: Record<string, string>) => ReactNode][] = [
  ['/', () => <ShopPage />],
  ['/products/:id', ({ id }) => <ProductPage id={Number(id)} />],
  ['/cart', () => <CartPage />],
  ['/checkout', () => <CheckoutPage />],
  ['/orders', () => <OrdersPage />],
  ['/orders/:id', ({ id }) => <OrderDetailPage id={Number(id)} />],
  ['/account', () => <AccountPage />],
  ['/dashboard', () => <DashboardPage />],
  ['/lab', () => <LabPage />],
]

const TITLES: Record<string, string> = { '/': 'Shop', '/cart': 'Cart', '/checkout': 'Checkout', '/orders': 'Orders', '/account': 'Account', '/dashboard': 'Dashboard', '/lab': 'QA lab' }

function Routes() {
  const { path } = useLocation()
  useEffect(() => {
    document.title = `${TITLES[path] ?? 'Kettle & Co.'} · Kettle & Co.`
  }, [path])
  for (const [pattern, render] of ROUTES) {
    const params = matchPath(pattern, path)
    if (params) return render(params)
  }
  return <NotFound />
}

function Header() {
  const me = useMe()
  const cart = useCart()
  const initials = me.data?.name.split(' ').map((part) => part[0]).join('') ?? '…'
  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="logo">
          <span className="logo-mark" aria-hidden="true">
            K
          </span>
          Kettle &amp; Co.
        </Link>
        <nav className="nav" aria-label="Main">
          <Link to="/" activePrefix>
            Shop
          </Link>
          <Link to="/orders" activePrefix>
            Orders
          </Link>
          <Link to="/dashboard" activePrefix>
            Dashboard
          </Link>
          <Link to="/lab" activePrefix>
            QA lab
          </Link>
        </nav>
        <div className="header-actions">
          <Link to="/cart" className="icon-link" aria-label={`Cart, ${cart.data?.count ?? 0} items`}>
            <span aria-hidden="true">🛒</span> Cart <span className="count-badge">{cart.data?.count ?? 0}</span>
          </Link>
          <Link to="/account" className="avatar" aria-label={`Account for ${me.data?.name ?? 'you'}`} title={me.data?.name}>
            {initials}
          </Link>
        </div>
      </div>
    </header>
  )
}

/** Floating support chat in the bottom-left corner, opposite the Bugcrumbs button. */
function SupportChat() {
  const [open, setOpen] = useState(false)
  const toast = useToast()
  const send = useMutation({
    mutationKey: ['support', 'send'],
    mutationFn: (message: string) => api<{ ticket: string }>('/api/support', { method: 'POST', body: { message } }),
    onSuccess: (result) => {
      toast(`Thanks! Ticket ${result.ticket} created — we reply within a day.`, 'success')
      setOpen(false)
    },
  })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const message = String(new FormData(event.currentTarget).get('message') ?? '')
    if (message.trim()) send.mutate(message)
  }
  return (
    <>
      {open && (
        <div className="drawer" role="dialog" aria-label="Support chat">
          <div className="between">
            <h3 style={{ margin: 0 }}>Chat with support</h3>
            <Button variant="ghost" size="sm" aria-label="Close support chat" onClick={() => setOpen(false)}>
              ×
            </Button>
          </div>
          <p className="muted small">Typical reply time: under 1 day.</p>
          <form onSubmit={submit} className="stack">
            <textarea name="message" className="input" rows={3} placeholder="How can we help?" aria-label="Message" />
            <Button type="submit" variant="primary" loading={send.isPending}>
              Send message
            </Button>
          </form>
        </div>
      )}
      <button type="button" className="help-button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        💬 Need help?
      </button>
    </>
  )
}

export function App() {
  const [promo, setPromo] = useState(true)
  return (
    <div className={promo ? 'app' : 'app no-promo'}>
      {promo && (
        <div className="promo">
          Free UK shipping on orders over £50 · Use code SAVE10 for 10% off
          <button type="button" aria-label="Dismiss announcement" onClick={() => setPromo(false)}>
            ×
          </button>
        </div>
      )}
      <Header />
      <main className="page" id="main">
        <Routes />
      </main>
      <footer className="footer">
        Kettle &amp; Co. is a demo shop for testing Bugcrumbs. Nothing here is real — break things freely.
      </footer>
      <SupportChat />
    </div>
  )
}
