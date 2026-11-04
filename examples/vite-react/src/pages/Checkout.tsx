import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../api'
import { useCart } from '../hooks'
import { Link } from '../router'
import { Alert, Button, Field, Input, Select, Skeleton } from '../ui'
import { OrderSummary, readPromo } from './Cart'

export function CheckoutPage() {
  const cart = useCart()
  const [createAccount, setCreateAccount] = useState(true)
  const order = useMutation({
    mutationKey: ['place-order'],
    mutationFn: (input: Record<string, string>) => api<{ orderId: number }>('/api/orders', { method: 'POST', body: input }),
  })

  const placeOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    order.mutate(Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>)
  }

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/cart">Cart</Link> / <span>Checkout</span>
      </nav>
      <div className="steps" aria-label="Checkout progress">
        <span className="done">
          <b>✓</b> Cart
        </span>
        <span aria-hidden="true">—</span>
        <span className="current" aria-current="step">
          <b>2</b> Details &amp; payment
        </span>
        <span aria-hidden="true">—</span>
        <span>
          <b>3</b> Confirmation
        </span>
      </div>
      <div className="grid-2">
        <form onSubmit={placeOrder} className="stack" aria-label="Checkout">
          <Alert tone="info" title="Test mode">
            The form is prefilled with test data. Payments always time out in this demo.
          </Alert>
          <section className="card">
            <h2>Contact</h2>
            <div className="form-grid">
              <div className="full">
                <Field label="Email">{(props) => <Input name="email" type="email" autoComplete="email" defaultValue="ada@example.com" {...props} />}</Field>
              </div>
              <label className="check full">
                <input type="checkbox" checked={createAccount} onChange={(event) => setCreateAccount(event.target.checked)} /> Create an account for faster checkout
              </label>
              {createAccount && (
                <div className="full">
                  <Field label="Password" hint="At least 8 characters.">
                    {(props) => <Input name="password" type="password" autoComplete="new-password" defaultValue="hunter2" {...props} />}
                  </Field>
                </div>
              )}
            </div>
          </section>
          <section className="card">
            <h2>Shipping address</h2>
            <div className="form-grid">
              <div className="full">
                <Field label="Full name">{(props) => <Input name="name" autoComplete="name" defaultValue="Ada Lovelace" {...props} />}</Field>
              </div>
              <div className="full">
                <Field label="Address">{(props) => <Input name="address" autoComplete="street-address" defaultValue="12 St James’s Square" {...props} />}</Field>
              </div>
              <Field label="City">{(props) => <Input name="city" autoComplete="address-level2" defaultValue="London" {...props} />}</Field>
              <Field label="Postcode">{(props) => <Input name="postcode" autoComplete="postal-code" defaultValue="SW1Y 4JH" {...props} />}</Field>
              <div className="full">
                <Field label="Country">
                  {(props) => (
                    <Select name="country" autoComplete="country-name" defaultValue="United Kingdom" {...props}>
                      <option>United Kingdom</option>
                      <option>Ireland</option>
                      <option>France</option>
                      <option>Germany</option>
                    </Select>
                  )}
                </Field>
              </div>
            </div>
          </section>
          <section className="card">
            <h2>Payment</h2>
            <div className="form-grid">
              <div className="full">
                <Field label="Card number">{(props) => <Input name="cardNumber" autoComplete="cc-number" inputMode="numeric" defaultValue="4242 4242 4242 4242" {...props} />}</Field>
              </div>
              <Field label="Expiry">{(props) => <Input name="expiry" autoComplete="cc-exp" defaultValue="12/29" {...props} />}</Field>
              <Field label="CVC">{(props) => <Input name="cvc" autoComplete="cc-csc" inputMode="numeric" defaultValue="123" {...props} />}</Field>
            </div>
          </section>
          {order.isError && (
            <Alert title="Payment failed" action={<Button size="sm" type="submit">Try again</Button>}>
              {order.error.message}
            </Alert>
          )}
          <Button type="submit" variant="primary" loading={order.isPending} className="btn-block" style={{ height: 48 }}>
            {order.isPending ? 'Placing order…' : 'Place order'}
          </Button>
        </form>
        {cart.data ? <OrderSummary cart={cart.data} promo={readPromo()} /> : <Skeleton height={220} />}
      </div>
    </>
  )
}
