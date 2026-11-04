import { useCallback, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, ApiError, money, shortDate, type Order, type OrderSummary } from '../api'
import { Link } from '../router'
import { Alert, Badge, Button, Modal, Skeleton, Tabs, useToast } from '../ui'
import { NotFound } from './NotFound'

type Filter = 'all' | OrderSummary['status']
const TONE = { Processing: 'info', Shipped: 'warning', Delivered: 'success', Cancelled: 'neutral' } as const

export function OrdersPage() {
  const orders = useQuery({ queryKey: ['orders'], queryFn: () => api<OrderSummary[]>('/api/orders') })
  const [filter, setFilter] = useState<Filter>('all')
  const visible = orders.data?.filter((order) => filter === 'all' || order.status === filter) ?? []

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Your orders</h1>
          <p className="muted" style={{ margin: 0 }}>
            Track, return or buy again.
          </p>
        </div>
        <Tabs
          label="Filter orders"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'Processing', label: 'Processing' },
            { value: 'Shipped', label: 'Shipped' },
            { value: 'Delivered', label: 'Delivered' },
          ]}
        />
      </div>
      <section className="card" aria-label="Order history" style={{ padding: 0, overflow: 'hidden' }}>
        {orders.isPending ? (
          <div className="stack" style={{ padding: 20 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} height={28} />
            ))}
          </div>
        ) : orders.isError ? (
          <div style={{ padding: 20 }}>
            <Alert title="Couldn’t load your orders">{orders.error.message}</Alert>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Date</th>
                <th scope="col">Items</th>
                <th scope="col">Status</th>
                <th scope="col" className="num">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link to={`/orders/${order.id}`} style={{ fontWeight: 600 }}>
                      Order #{order.id}
                    </Link>
                  </td>
                  <td className="muted">{shortDate(order.date)}</td>
                  <td>{order.items.map((item) => item.name).join(', ')}</td>
                  <td>
                    <Badge tone={TONE[order.status]}>{order.status}</Badge>
                  </td>
                  <td className="num">{money(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p id="bottom-marker" className="muted small" style={{ textAlign: 'center', marginTop: 24 }}>
        End of order history
      </p>
    </>
  )
}

const STAGES = ['Order placed', 'Payment confirmed', 'Packed', 'Shipped', 'Delivered']
const REACHED: Record<OrderSummary['status'], number> = { Processing: 2, Shipped: 4, Delivered: 5, Cancelled: 1 }

export function OrderDetailPage({ id }: { id: number }) {
  const toast = useToast()
  const order = useQuery({ queryKey: ['order', id], queryFn: () => api<Order>(`/api/orders/${id}`) })
  const [confirming, setConfirming] = useState(false)
  const close = useCallback(() => setConfirming(false), [])
  const cancel = useMutation({
    mutationKey: ['order', 'cancel'],
    mutationFn: () => api(`/api/orders/${id}/cancel`, { method: 'POST' }),
    onSettled: close,
    onError: (error) => toast(error.message, 'danger'),
  })
  const invoice = useMutation({
    mutationKey: ['order', 'invoice'],
    mutationFn: () => api(`/api/orders/${id}/invoice`),
    onError: (error) => toast(`Invoice download failed: ${error.message}`, 'danger'),
  })

  if (order.isError) return order.error instanceof ApiError && order.error.status === 404 ? <NotFound what="order" /> : <Alert title="Couldn’t load this order">{order.error.message}</Alert>
  if (order.isPending) return <Skeleton height={320} />

  const o = order.data
  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/orders">Orders</Link> / <span>#{o.id}</span>
      </nav>
      <div className="page-header">
        <div>
          <h1>Order #{o.id}</h1>
          <p className="muted" style={{ margin: 0 }}>
            Placed {shortDate(o.date)} · <Badge tone={TONE[o.status]}>{o.status}</Badge>
          </p>
        </div>
        <div className="row">
          <Button loading={invoice.isPending} onClick={() => invoice.mutate()}>
            Download invoice
          </Button>
          <Button variant="danger" disabled={o.status === 'Cancelled'} onClick={() => setConfirming(true)}>
            Cancel order
          </Button>
        </div>
      </div>
      <div className="grid-2">
        <section className="card" aria-label="Items">
          <h2>Items</h2>
          {o.items.map((item) => (
            <div key={item.productId} className="between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <Link to={`/products/${item.productId}`}>
                {item.name} × {item.qty}
              </Link>
              <span>{money(item.price * item.qty)}</span>
            </div>
          ))}
          <div className="summary-row summary-total">
            <span>Total paid</span>
            <span>{money(o.total)}</span>
          </div>
        </section>
        <div className="stack">
          <section className="card" aria-label="Tracking">
            <h2>Tracking</h2>
            <ol className="timeline">
              {STAGES.map((stage, i) => (
                <li key={stage} className={i < REACHED[o.status] ? 'reached' : ''}>
                  {stage}
                </li>
              ))}
            </ol>
          </section>
          <section className="card" aria-label="Delivery address">
            <h2>Delivery address</h2>
            <address style={{ fontStyle: 'normal' }} className="muted">
              {o.address.name}
              <br />
              {o.address.line1}
              <br />
              {o.address.city} {o.address.postcode}
              <br />
              {o.address.country}
            </address>
          </section>
        </div>
      </div>
      <Modal
        open={confirming}
        title={`Cancel order #${o.id}?`}
        onClose={close}
        footer={
          <>
            <Button onClick={close}>Keep order</Button>
            <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              Yes, cancel it
            </Button>
          </>
        }
      >
        <p className="muted">We’ll refund {money(o.total)} to your original payment method within 5 working days.</p>
      </Modal>
    </>
  )
}
