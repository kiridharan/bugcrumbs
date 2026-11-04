import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api, money, type Cart } from '../api'
import { useCart, useRemoveFromCart, useUpdateQty } from '../hooks'
import { Link, navigate } from '../router'
import { Alert, Button, EmptyState, Input, ProductArt, QtyStepper, Skeleton } from '../ui'

export type Promo = { code: string; discount: number; label: string }
const PROMO_KEY = 'kettle-promo'

export function readPromo(): Promo | undefined {
  try {
    return JSON.parse(sessionStorage.getItem(PROMO_KEY) ?? 'null') ?? undefined
  } catch {
    return undefined
  }
}

export function totals(cart: Cart, promo?: Promo) {
  const discount = promo ? Math.round(cart.subtotal * promo.discount * 100) / 100 : 0
  const shipping = cart.subtotal - discount >= 50 || cart.count === 0 ? 0 : 4.95
  return { discount, shipping, total: cart.subtotal - discount + shipping }
}

export function OrderSummary({ cart, promo, children }: { cart: Cart; promo?: Promo; children?: React.ReactNode }) {
  const { discount, shipping, total } = totals(cart, promo)
  return (
    <aside className="card" aria-label="Order summary">
      <h2>Order summary</h2>
      <div className="summary-row">
        <span className="muted">Subtotal ({cart.count} items)</span>
        <span>{money(cart.subtotal)}</span>
      </div>
      {promo && (
        <div className="summary-row" style={{ color: 'var(--success)' }}>
          <span>Promo {promo.code}</span>
          <span>−{money(discount)}</span>
        </div>
      )}
      <div className="summary-row">
        <span className="muted">Shipping</span>
        <span>{shipping ? money(shipping) : 'Free'}</span>
      </div>
      <div className="summary-row summary-total">
        <span>Total</span>
        <span>{money(total)}</span>
      </div>
      {children}
    </aside>
  )
}

export function CartPage() {
  const cart = useCart()
  const updateQty = useUpdateQty()
  const remove = useRemoveFromCart()
  const [promo, setPromo] = useState(readPromo)
  const [promoError, setPromoError] = useState<string>()
  const applyPromo = useMutation({
    mutationKey: ['promo', 'apply'],
    mutationFn: (code: string) => api<Promo>('/api/promo', { method: 'POST', body: { code } }),
    onSuccess: (result) => {
      setPromo(result)
      setPromoError(undefined)
      sessionStorage.setItem(PROMO_KEY, JSON.stringify(result))
    },
    onError: (error) => setPromoError(error.message),
  })

  const submitPromo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const code = String(new FormData(event.currentTarget).get('code') ?? '').trim()
    if (code) applyPromo.mutate(code)
  }

  if (cart.isPending) return <Skeleton height={300} />
  if (cart.isError) return <Alert title="Your cart couldn’t be loaded">{cart.error.message}</Alert>
  if (!cart.data.items.length)
    return (
      <EmptyState title="Your cart is empty" action={<Button variant="primary" onClick={() => navigate('/')}>Browse the shop</Button>}>
        Good coffee is one click away.
      </EmptyState>
    )

  return (
    <>
      <div className="page-header">
        <h1>Your cart</h1>
        <Link to="/">Continue shopping</Link>
      </div>
      <div className="grid-2">
        <section className="card" aria-label="Cart items">
          {cart.data.items.map(({ product, qty }) => (
            <div key={product.id} className="line-item">
              <ProductArt category={product.category} color={product.color} size="sm" />
              <div className="line-info">
                <Link to={`/products/${product.id}`} className="product-name">
                  {product.name}
                </Link>
                <div className="muted small">{money(product.price)} each</div>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate({ productId: product.id, name: product.name })} style={{ paddingLeft: 0 }}>
                  Remove
                </Button>
              </div>
              <QtyStepper label={`${product.name} quantity`} value={qty} max={9} disabled={updateQty.isPending} onChange={(next) => updateQty.mutate({ productId: product.id, qty: next })} />
              <strong className="price">{money(product.price * qty)}</strong>
            </div>
          ))}
          <p className="muted small" style={{ marginTop: 12 }}>
            Limit: 5 per customer per item.
          </p>
        </section>
        <OrderSummary cart={cart.data} promo={promo}>
          <form onSubmit={submitPromo} className="row" style={{ margin: '16px 0', flexWrap: 'nowrap' }}>
            <Input name="code" placeholder="Promo code" aria-label="Promo code" aria-invalid={promoError ? true : undefined} />
            <Button type="submit" loading={applyPromo.isPending}>
              Apply
            </Button>
          </form>
          {promoError && <p className="field-error">{promoError}</p>}
          {promo && (
            <p className="small" style={{ color: 'var(--success)' }}>
              {promo.label} applied.{' '}
              <button type="button" className="th-button" style={{ textDecoration: 'underline' }} onClick={() => (setPromo(undefined), sessionStorage.removeItem(PROMO_KEY))}>
                Remove
              </button>
            </p>
          )}
          <Button variant="primary" className="btn-block" onClick={() => navigate('/checkout')}>
            Go to checkout
          </Button>
        </OrderSummary>
      </div>
    </>
  )
}
