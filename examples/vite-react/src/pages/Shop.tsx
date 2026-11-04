import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, money, type Category, type Product } from '../api'
import { useAddToCart, useMe } from '../hooks'
import { Link, navigate, useLocation } from '../router'
import { Alert, Badge, Button, EmptyState, ProductArt, Select, Skeleton, Stars } from '../ui'

const CATEGORIES: { value: Category | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'tea', label: 'Tea' },
  { value: 'brewing', label: 'Brewing' },
  { value: 'gear', label: 'Gear' },
]

export function ProductCard({ product }: { product: Product }) {
  const add = useAddToCart()
  const soldOut = product.stock === 0
  return (
    <article className="product-card">
      <Link to={`/products/${product.id}`} aria-label={product.name}>
        <ProductArt category={product.category} color={product.color} />
      </Link>
      <div className="product-body">
        <div className="between">
          <Link to={`/products/${product.id}`} className="product-name">
            {product.name}
          </Link>
          {soldOut ? <Badge tone="danger">Sold out</Badge> : product.stock < 10 && <Badge tone="warning">Only {product.stock} left</Badge>}
        </div>
        <Stars rating={product.rating} count={product.reviews} />
        <div className="between" style={{ marginTop: 'auto', paddingTop: 8 }}>
          <span className="price">{money(product.price)}</span>
          {/* Sold-out items stay clickable on purpose: the API answers 409, a bug worth reporting. */}
          <Button size="sm" variant="primary" loading={add.isPending} onClick={() => add.mutate({ productId: product.id, name: product.name })}>
            Add to cart
          </Button>
        </div>
      </div>
    </article>
  )
}

export function ShopPage() {
  const { params } = useLocation()
  const me = useMe()
  const q = params.get('q') ?? ''
  const category = (params.get('category') ?? '') as Category | ''
  const sort = params.get('sort') ?? 'popular'
  const [search, setSearch] = useState(q)

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    const query = next.toString()
    navigate(query ? `/?${query}` : '/', { replace: key === 'q', scroll: false })
  }

  // Debounced search, kept in the URL so a report shows exactly what was searched.
  useEffect(() => {
    if (search === q) return
    const timer = setTimeout(() => setParam('q', search.trim()), 300)
    return () => clearTimeout(timer)
  })

  const products = useQuery({
    queryKey: ['products', { q, category, sort }],
    queryFn: () => api<Product[]>(`/api/products?${new URLSearchParams({ q, category, sort })}`),
    placeholderData: (previous) => previous,
  })

  return (
    <>
      <section className="hero">
        <div>
          <p className="muted" style={{ fontWeight: 600 }}>
            Signed in as {me.data?.name.split(' ')[0] ?? '…'}
          </p>
          <h1>Brew better at home.</h1>
          <p className="muted">Small-batch coffee, single-estate tea and the gear to make it properly. Roasted on Mondays, shipped on Tuesdays.</p>
          <div className="row">
            <Button variant="primary" onClick={() => setParam('category', 'coffee')}>
              Shop coffee
            </Button>
            <Button onClick={() => setParam('category', 'brewing')}>Brewing gear</Button>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <ProductArt category="coffee" color="#b45309" />
          <ProductArt category="tea" color="#15803d" />
          <ProductArt category="brewing" color="#334155" />
          <ProductArt category="gear" color="#7c3aed" />
        </div>
      </section>

      <div className="toolbar">
        <div className="search">
          <input
            className="input"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search coffee, tea and gear…"
            aria-label="Search products"
          />
        </div>
        <div className="chips" role="group" aria-label="Category">
          {CATEGORIES.map((option) => (
            <button key={option.value} type="button" className="chip" aria-pressed={category === option.value} onClick={() => setParam('category', option.value)}>
              {option.label}
            </button>
          ))}
        </div>
        <Select aria-label="Sort by" value={sort} onChange={(event) => setParam('sort', event.target.value)} style={{ width: 180 }}>
          <option value="popular">Most popular</option>
          <option value="rating">Top rated</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </Select>
      </div>

      {products.isError ? (
        <Alert
          title="We couldn’t load products"
          action={
            <Button size="sm" onClick={() => products.refetch()}>
              Try again
            </Button>
          }
        >
          {products.error.message}
        </Alert>
      ) : products.isPending ? (
        <div className="products">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="product-card">
              <Skeleton height={180} />
              <div className="product-body">
                <Skeleton width="70%" />
                <Skeleton width="40%" />
              </div>
            </div>
          ))}
        </div>
      ) : products.data.length === 0 ? (
        <EmptyState title="No products match" action={<Button onClick={() => (setSearch(''), navigate('/'))}>Clear filters</Button>}>
          Try a different search or category.
        </EmptyState>
      ) : (
        <>
          <p className="muted small" aria-live="polite">
            {products.data.length} products{products.isFetching ? ' · updating…' : ''}
          </p>
          <div className="products">
            {products.data.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </>
  )
}
