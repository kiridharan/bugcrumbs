import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getBugcrumbs } from '@bugcrumbs/core'
import { api } from '../api'
import { Link, navigate } from '../router'
import { Badge, Button } from '../ui'

/** Bugs planted around the shop, for practising real reports. */
const BUG_HUNT: { where: string; to: string; what: string }[] = [
  { where: 'Shop', to: '/', what: 'Search for a name with an apostrophe (e.g. tester’s → type it with a straight quote: tester\'s). The API returns a 500.' },
  { where: 'Shop', to: '/', what: 'Add the “Limited Edition Copper Kettle” to the cart. It is sold out but the button still works — 409.' },
  { where: 'Product', to: '/products/3', what: 'Open Sumatra Mandheling: the reviews service fails after a slow load.' },
  { where: 'Product', to: '/products/1', what: 'Post a short review: validation only happens on the server (422).' },
  { where: 'Cart', to: '/cart', what: 'Raise a quantity to 5. The limit is “5 per customer”, but 5 itself is rejected (off-by-one).' },
  { where: 'Cart', to: '/cart', what: 'Try promo codes FREESHIP (expired, 410) and anything unknown (422). SAVE10 works.' },
  { where: 'Checkout', to: '/checkout', what: 'Place the order: the payment provider times out (500) after a long wait.' },
  { where: 'Orders', to: '/orders/1041', what: 'Cancel a delivered order (403) or download its invoice (404).' },
  { where: 'Account', to: '/account', what: 'Clear your name and save (422 with field errors). Reveal the API key — it must be redacted in the report.' },
  { where: 'Dashboard', to: '/dashboard', what: 'Click “Show breakdown” — the widget crashes during render. Switch to 90 days for a slow request.' },
  { where: 'Anywhere', to: '/products/999', what: 'Visit a product that doesn’t exist (404 page).' },
]

function xhrGet(url: string): Promise<number> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url)
    xhr.setRequestHeader('authorization', 'Bearer demo-token')
    xhr.onloadend = () => resolve(xhr.status)
    xhr.send()
  })
}

function Crash(): never {
  throw new Error('Lab: component crashed while rendering')
}

export function LabPage() {
  const [result, setResult] = useState('')
  const [loadInventory, setLoadInventory] = useState(false)
  const [brokenImage, setBrokenImage] = useState(false)
  const [crash, setCrash] = useState(false)
  const inventory = useQuery({ queryKey: ['inventory', { warehouse: 'eu-1' }], queryFn: () => api('/api/inventory'), enabled: loadInventory })

  const report = (text: string) => setResult(`${new Date().toLocaleTimeString()} — ${text}`)

  return (
    <>
      <div className="page-header">
        <div>
          <h1>QA lab</h1>
          <p className="muted" style={{ margin: 0 }}>
            One-click failures for every kind of data Bugcrumbs captures. Then open the Bugcrumbs button in the bottom-right corner.
          </p>
        </div>
        <Badge tone="warning">Test environment</Badge>
      </div>

      <div className="lab-grid">
        <section className="card" aria-labelledby="lab-network">
          <h2 id="lab-network">Network &amp; queries</h2>
          <p className="muted small">fetch, XHR and TanStack Query failures (FR-01, FR-07).</p>
          <div className="lab-actions">
            <Button onClick={() => setLoadInventory(true)}>Fail a query</Button>
            <span className="lab-result">Inventory: {inventory.status}</span>
            <Button onClick={async () => report(`XHR finished with ${await xhrGet('/api/products/999')}`)}>Send failing XHR</Button>
            <Button
              onClick={async () => {
                report('Slow request started (3 s)…')
                await api('/api/slow')
                report('Slow request finished')
              }}
            >
              Slow request
            </Button>
          </div>
        </section>

        <section className="card" aria-labelledby="lab-console">
          <h2 id="lab-console">Console</h2>
          <p className="muted small">Logs with values that must be redacted (FR-02, FR-21).</p>
          <div className="lab-actions">
            <Button onClick={() => console.error('Price mismatch', { expected: 10, got: 12, token: 'secret' })}>Log error</Button>
            <Button onClick={() => console.warn('Deprecated: cart.v1 endpoint will be removed', { sunset: '2027-01-01' })}>Log warning</Button>
            <Button
              onClick={() => {
                for (let i = 0; i < 50; i++) console.info(`Polling tick ${i}`, { i })
                report('Logged 50 info lines')
              }}
            >
              Flood the console
            </Button>
          </div>
        </section>

        <section className="card" aria-labelledby="lab-errors">
          <h2 id="lab-errors">Errors</h2>
          <p className="muted small">Uncaught errors, rejections, failed resources and render crashes (FR-03, FR-04).</p>
          <div className="lab-actions">
            <Button
              onClick={() =>
                setTimeout(() => {
                  throw new TypeError("Cannot read properties of undefined (reading 'price')")
                })
              }
            >
              Throw uncaught error
            </Button>
            <Button onClick={() => Promise.reject(new Error('Unhandled rejection from the demo'))}>Reject promise</Button>
            <Button onClick={() => setBrokenImage(true)}>Load a broken image</Button>
            {brokenImage && <img src="/images/missing-banner.png" alt="" width={1} height={1} />}
            <Button onClick={() => setCrash(true)}>Crash a component</Button>
            {crash && <Crash />}
          </div>
        </section>

        <section className="card" aria-labelledby="lab-steps">
          <h2 id="lab-steps">Steps</h2>
          <p className="muted small">Navigation and manual marks (FR-05). Query strings are redacted.</p>
          <div className="lab-actions">
            <Button onClick={() => (getBugcrumbs().mark('Tester marked this moment'), report('Step marked'))}>Mark step</Button>
            <Button onClick={() => navigate('/orders/1042?ref=email&session=abc123')}>Open magic link</Button>
          </div>
        </section>
      </div>

      <p className="lab-result" role="status" style={{ marginTop: 16 }}>
        {result}
      </p>

      <section className="card" aria-labelledby="bug-hunt" style={{ marginTop: 24 }}>
        <h2 id="bug-hunt">Bug hunt</h2>
        <p className="muted">These bugs are planted in the shop. Find each one, then file it with Bugcrumbs — try “Save and start next” to batch them and export a CSV.</p>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Where</th>
              <th scope="col">What to try</th>
            </tr>
          </thead>
          <tbody>
            {BUG_HUNT.map((bug) => (
              <tr key={bug.what}>
                <td>
                  <Link to={bug.to}>{bug.where}</Link>
                </td>
                <td>{bug.what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}
