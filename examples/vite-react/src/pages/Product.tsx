import { useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, ApiError, money, type Product, type Review } from '../api'
import { useAddToCart } from '../hooks'
import { Link } from '../router'
import { Alert, Badge, Button, Field, ProductArt, QtyStepper, Select, Skeleton, Stars, useToast } from '../ui'
import { NotFound } from './NotFound'

function Reviews({ product }: { product: Product }) {
  const toast = useToast()
  const reviews = useQuery({ queryKey: ['reviews', product.id], queryFn: () => api<Review[]>(`/api/products/${product.id}/reviews`) })
  const [error, setError] = useState<string>()
  const write = useMutation({
    mutationKey: ['reviews', 'create'],
    mutationFn: (body: { rating: number; text: string }) => api(`/api/products/${product.id}/reviews`, { method: 'POST', body }),
    onSuccess: () => toast('Thanks! Your review will appear after moderation.', 'success'),
    onError: (err) => setError(err.message),
  })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(undefined)
    const data = new FormData(event.currentTarget)
    write.mutate({ rating: Number(data.get('rating')), text: String(data.get('text') ?? '') })
  }

  return (
    <section className="card" style={{ marginTop: 32 }} aria-labelledby="reviews-heading">
      <div className="between">
        <h2 id="reviews-heading">Customer reviews</h2>
        <Stars rating={product.rating} count={product.reviews} />
      </div>
      {reviews.isPending ? (
        <div className="stack" style={{ marginTop: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="stack" style={{ gap: 6 }}>
              <Skeleton width="30%" />
              <Skeleton />
            </div>
          ))}
        </div>
      ) : reviews.isError ? (
        <Alert
          title="Reviews are unavailable right now"
          action={
            <Button size="sm" onClick={() => reviews.refetch()}>
              Retry
            </Button>
          }
        >
          {reviews.error.message}
        </Alert>
      ) : (
        reviews.data.map((review) => (
          <div key={review.id} className="review">
            <div className="between">
              <strong>{review.author}</strong>
              <span className="muted small">{review.date}</span>
            </div>
            <Stars rating={review.rating} />
            <p style={{ margin: '6px 0 0' }}>{review.text}</p>
          </div>
        ))
      )}

      <form onSubmit={submit} className="stack" style={{ marginTop: 20 }}>
        <h3>Write a review</h3>
        <Field label="Rating">{(props) => <Select name="rating" defaultValue="5" {...props}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}</Select>}</Field>
        <Field label="Your review" error={error} hint="At least 20 characters.">
          {(props) => <textarea name="text" rows={3} className="input" {...props} />}
        </Field>
        <div>
          <Button type="submit" variant="primary" loading={write.isPending}>
            Post review
          </Button>
        </div>
      </form>
    </section>
  )
}

export function ProductPage({ id }: { id: number }) {
  const product = useQuery({ queryKey: ['product', id], queryFn: () => api<Product>(`/api/products/${id}`) })
  const add = useAddToCart()
  const [qty, setQty] = useState(1)

  if (product.isError) return product.error instanceof ApiError && product.error.status === 404 ? <NotFound what="product" /> : <Alert title="Couldn’t load this product">{product.error.message}</Alert>
  if (product.isPending)
    return (
      <div className="product-layout">
        <Skeleton height={420} />
        <div className="stack">
          <Skeleton height={36} width="70%" />
          <Skeleton width="40%" />
          <Skeleton height={120} />
        </div>
      </div>
    )

  const p = product.data
  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Shop</Link> / <Link to={`/?category=${p.category}`}>{p.category[0]!.toUpperCase() + p.category.slice(1)}</Link> / <span>{p.name}</span>
      </nav>
      <div className="product-layout">
        <ProductArt category={p.category} color={p.color} size="lg" />
        <div className="stack" style={{ alignContent: 'start' }}>
          <div>
            <h1>{p.name}</h1>
            <Stars rating={p.rating} count={p.reviews} />
          </div>
          <div className="row">
            <span className="price" style={{ fontSize: 26 }}>
              {money(p.price)}
            </span>
            {p.stock === 0 ? <Badge tone="danger">Sold out</Badge> : p.stock < 10 ? <Badge tone="warning">Only {p.stock} left</Badge> : <Badge tone="success">In stock</Badge>}
          </div>
          <p className="muted">{p.description}</p>
          <div className="row">
            <QtyStepper label="Quantity" value={qty} onChange={setQty} max={10} />
            <Button variant="primary" loading={add.isPending} onClick={() => add.mutate({ productId: p.id, name: p.name, qty })}>
              Add to cart · {money(p.price * qty)}
            </Button>
          </div>
          <p className="muted small">Free UK shipping over £50 · 30-day returns</p>
          <table className="specs">
            <tbody>
              {Object.entries(p.specs).map(([key, value]) => (
                <tr key={key}>
                  <th scope="row">{key}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Reviews product={p} />
    </>
  )
}
