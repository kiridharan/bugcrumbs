import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

/**
 * In-memory fake backend for the demo shop. Most endpoints work; some fail the way real backends
 * do (timeouts, validation errors, conflicts, slow responses) so there is something to report.
 */

interface Product {
  id: number
  name: string
  category: 'coffee' | 'tea' | 'brewing' | 'gear'
  price: number
  rating: number
  reviews: number
  stock: number
  color: string
  description: string
  specs: Record<string, string>
}

const PRODUCTS: Product[] = [
  { id: 1, name: 'Ethiopia Yirgacheffe', category: 'coffee', price: 18, rating: 4.8, reviews: 214, stock: 40, color: '#b45309', description: 'Bright and floral with notes of bergamot, jasmine and lemon. Washed process, light roast.', specs: { Origin: 'Gedeo, Ethiopia', Roast: 'Light', Weight: '250 g', Process: 'Washed' } },
  { id: 2, name: 'Colombia Huila', category: 'coffee', price: 16, rating: 4.6, reviews: 178, stock: 25, color: '#92400e', description: 'Balanced and sweet: caramel, red apple and milk chocolate. A crowd pleaser for any brew method.', specs: { Origin: 'Huila, Colombia', Roast: 'Medium', Weight: '250 g', Process: 'Washed' } },
  { id: 3, name: 'Sumatra Mandheling', category: 'coffee', price: 17, rating: 4.3, reviews: 96, stock: 12, color: '#451a03', description: 'Earthy, heavy body with cedar and dark cocoa. Great for espresso and French press.', specs: { Origin: 'North Sumatra', Roast: 'Dark', Weight: '250 g', Process: 'Wet-hulled' } },
  { id: 4, name: 'Darjeeling First Flush', category: 'tea', price: 22, rating: 4.7, reviews: 64, stock: 18, color: '#65a30d', description: 'Spring-picked, delicate and muscatel. Brew at 85 °C for three minutes.', specs: { Origin: 'Darjeeling, India', Type: 'Black', Weight: '100 g' } },
  { id: 5, name: 'Gyokuro Imperial', category: 'tea', price: 34, rating: 4.9, reviews: 41, stock: 6, color: '#15803d', description: 'Shade-grown Japanese green tea, intensely sweet and savoury.', specs: { Origin: 'Yame, Japan', Type: 'Green', Weight: '50 g' } },
  { id: 6, name: 'Gooseneck Kettle', category: 'brewing', price: 89, rating: 4.7, reviews: 302, stock: 15, color: '#334155', description: 'Variable temperature, 0.9 L, with a precise pour spout and hold mode.', specs: { Capacity: '0.9 L', Power: '1200 W', Material: 'Stainless steel' } },
  { id: 7, name: 'Limited Edition Copper Kettle', category: 'brewing', price: 149, rating: 4.9, reviews: 23, stock: 0, color: '#c2410c', description: 'Hand-spun copper, numbered edition of 500. Currently sold out.', specs: { Capacity: '1.0 L', Material: 'Copper', Edition: '500 units' } },
  { id: 8, name: 'Ceramic Pour-Over Dripper', category: 'brewing', price: 28, rating: 4.5, reviews: 187, stock: 50, color: '#e11d48', description: 'Spiral ribs for an even extraction. Fits size 02 filters.', specs: { Size: '02', Material: 'Porcelain', Cups: '1–4' } },
  { id: 9, name: 'Burr Grinder Pro', category: 'gear', price: 199, rating: 4.6, reviews: 412, stock: 9, color: '#0f172a', description: '40 grind settings from espresso to cold brew, with a low-retention chute.', specs: { Burrs: '40 mm conical', Settings: '40', Hopper: '250 g' } },
  { id: 10, name: 'Digital Brew Scale', category: 'gear', price: 49, rating: 4.4, reviews: 256, stock: 30, color: '#0e7490', description: '0.1 g precision with a built-in timer and auto-tare.', specs: { Precision: '0.1 g', Max: '2 kg', Battery: 'USB-C' } },
  { id: 11, name: 'Glass Cold Brew Jar', category: 'brewing', price: 32, rating: 4.2, reviews: 88, stock: 22, color: '#0369a1', description: 'One litre of smooth cold brew. Fine mesh filter, airtight lid.', specs: { Capacity: '1 L', Material: 'Borosilicate glass' } },
  { id: 12, name: 'Travel Tumbler', category: 'gear', price: 29, rating: 4.1, reviews: 143, stock: 70, color: '#7c3aed', description: 'Keeps coffee hot for 6 hours. Leak-proof, fits car cup holders.', specs: { Capacity: '350 ml', Insulation: 'Double wall' } },
]

const STATUSES = ['Delivered', 'Delivered', 'Shipped', 'Processing', 'Delivered', 'Cancelled'] as const
const ORDERS = Array.from({ length: 32 }, (_, i) => {
  const id = 1048 - i
  const items = [PRODUCTS[i % 12]!, PRODUCTS[(i * 5 + 3) % 12]!].slice(0, (i % 2) + 1)
  return {
    id,
    date: new Date(Date.UTC(2026, 9, 30) - i * 2.5 * 86_400_000).toISOString(),
    status: i < 2 ? 'Processing' : STATUSES[i % STATUSES.length]!,
    items: items.map((product, n) => ({ productId: product.id, name: product.name, price: product.price, qty: n + 1 })),
    total: items.reduce((sum, product, n) => sum + product.price * (n + 1), 0) + 5,
  }
})

let cart = [
  { productId: 2, qty: 1 },
  { productId: 8, qty: 1 },
  { productId: 10, qty: 1 },
]
let me = { id: 42, name: 'Ada Lovelace', email: 'ada@example.com', company: 'Analytical Engines Ltd', plan: 'Pro', sessionToken: 'tok_live_123' }

type Reply = { status: number; body?: unknown; delay?: number }
type Handler = (ctx: { params: Record<string, string>; query: URLSearchParams; body: any }) => Reply

const ok = (body: unknown, delay?: number): Reply => ({ status: 200, body, delay })
const fail = (status: number, error: string, extra: object = {}): Reply => ({ status, body: { error, ...extra } })

function cartView() {
  const items = cart.map((item) => ({ ...item, product: PRODUCTS.find((product) => product.id === item.productId)! }))
  return { items, count: items.reduce((sum, item) => sum + item.qty, 0), subtotal: items.reduce((sum, item) => sum + item.qty * item.product.price, 0) }
}

function series(days: number) {
  return Array.from({ length: days }, (_, i) => {
    const wave = Math.sin(i / 3) * 400 + Math.cos(i / 7) * 250
    return { day: new Date(Date.UTC(2026, 10, 3) - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10), revenue: Math.round(2400 + wave + ((i * 137) % 500)), orders: Math.round(48 + wave / 40 + ((i * 7) % 12)) }
  })
}

const ROUTES: [string, Handler][] = [
  ['GET /api/me', () => ok(me)],
  [
    'PATCH /api/me',
    ({ body }) => {
      const errors: Record<string, string> = {}
      if (!body?.name?.trim()) errors.name = 'Name is required'
      if (body?.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) errors.email = 'Enter a valid email address'
      if (Object.keys(errors).length) return fail(422, 'Validation failed', { errors })
      me = { ...me, ...body }
      return ok(me)
    },
  ],
  ['GET /api/me/api-key', () => ok({ apiKey: 'kettle_demo_key_0000_not_a_real_secret', createdAt: '2026-08-14T09:12:00Z' })],
  ['POST /api/me/password', () => fail(401, 'Current password is incorrect')],
  [
    'GET /api/products',
    ({ query }) => {
      const q = (query.get('q') ?? '').toLowerCase()
      // A realistic backend bug: the search endpoint chokes on apostrophes.
      if (q.includes("'")) return fail(500, `syntax error at or near "${q.split("'")[1] ?? ''}"`, { code: 'DB_QUERY_FAILED' })
      const category = query.get('category')
      const sort = query.get('sort') ?? 'popular'
      const list = PRODUCTS.filter((product) => (!category || product.category === category) && (!q || product.name.toLowerCase().includes(q)))
      list.sort((a, b) => (sort === 'price-asc' ? a.price - b.price : sort === 'price-desc' ? b.price - a.price : sort === 'rating' ? b.rating - a.rating : b.reviews - a.reviews))
      return ok(list, 250)
    },
  ],
  ['GET /api/products/:id', ({ params }) => { const product = PRODUCTS.find((p) => p.id === Number(params.id)); return product ? ok(product) : fail(404, 'Product not found') }],
  [
    'GET /api/products/:id/reviews',
    ({ params }) => {
      if (params.id === '3') return { ...fail(500, 'Reviews service: upstream connect error'), delay: 900 }
      return ok(
        [
          { id: 1, author: 'Grace H.', rating: 5, date: '2026-10-21', text: 'Exactly as described. Became my daily brew within a week.' },
          { id: 2, author: 'Alan T.', rating: 4, date: '2026-10-02', text: 'Very good, though shipping took a few extra days.' },
          { id: 3, author: 'Katherine J.', rating: 5, date: '2026-09-15', text: 'Bought a second one as a gift.' },
        ],
        1200,
      )
    },
  ],
  ['POST /api/products/:id/reviews', ({ body }) => ((body?.text ?? '').trim().length < 20 ? fail(422, 'Reviews must be at least 20 characters') : { status: 201, body: { id: Date.now(), ...body } })],
  ['GET /api/cart', () => ok(cartView())],
  [
    'POST /api/cart/items',
    ({ body }) => {
      const product = PRODUCTS.find((p) => p.id === body?.productId)
      if (!product) return fail(404, 'Product not found')
      if (product.stock === 0) return fail(409, `${product.name} is out of stock`, { productId: product.id, stock: 0 })
      const line = cart.find((item) => item.productId === product.id)
      if (line) line.qty += body.qty ?? 1
      else cart = [...cart, { productId: product.id, qty: body.qty ?? 1 }]
      return ok(cartView())
    },
  ],
  [
    'PATCH /api/cart/items/:id',
    ({ params, body }) => {
      // Off-by-one in the backend: the limit is meant to be 5 but 5 itself is rejected.
      if (body?.qty >= 5) return fail(400, 'Maximum 5 per customer', { field: 'qty', max: 5 })
      cart = cart.map((item) => (item.productId === Number(params.id) ? { ...item, qty: body.qty } : item))
      return ok(cartView())
    },
  ],
  ['DELETE /api/cart/items/:id', ({ params }) => { cart = cart.filter((item) => item.productId !== Number(params.id)); return ok(cartView()) }],
  [
    'POST /api/promo',
    ({ body }) => {
      const code = String(body?.code ?? '').trim().toUpperCase()
      if (code === 'SAVE10') return ok({ code, discount: 0.1, label: '10% off' })
      if (code === 'FREESHIP') return fail(410, 'This promo code expired on 31 October')
      return fail(422, 'Promo code not recognised')
    },
  ],
  ['POST /api/orders', () => ({ ...fail(500, 'Payment provider timeout', { orderId: null, provider: 'stripe-mock', attempt: 1 }), delay: 1200 })],
  ['GET /api/orders', () => ok(ORDERS)],
  ['GET /api/orders/:id', ({ params }) => { const order = ORDERS.find((o) => o.id === Number(params.id)); return order ? ok({ ...order, address: { name: 'Ada Lovelace', line1: '12 St James’s Square', city: 'London', postcode: 'SW1Y 4JH', country: 'United Kingdom' } }) : fail(404, 'Order not found') }],
  ['POST /api/orders/:id/cancel', () => fail(403, 'Orders that have shipped cannot be cancelled')],
  ['GET /api/orders/:id/invoice', () => fail(404, 'Invoice not generated yet')],
  [
    'GET /api/stats',
    ({ query }) => {
      const range = query.get('range') ?? '7d'
      const days = range === '90d' ? 90 : range === '30d' ? 30 : 7
      const points = series(days)
      const revenue = points.reduce((sum, p) => sum + p.revenue, 0)
      const orders = points.reduce((sum, p) => sum + p.orders, 0)
      return ok(
        {
          range,
          revenue,
          orders,
          averageOrder: Math.round((revenue / orders) * 100) / 100,
          conversion: 3.2 + days / 100,
          deltas: { revenue: 12.4, orders: 8.1, averageOrder: 3.9, conversion: -0.4 },
          series: points,
          topProducts: PRODUCTS.slice(0, 8).map((p, i) => ({ id: p.id, name: p.name, units: 220 - i * 23, revenue: (220 - i * 23) * p.price })),
        },
        range === '90d' ? 2500 : 300,
      )
    },
  ],
  ['GET /api/inventory', () => fail(503, 'Inventory service unavailable', { retryAfter: 30 })],
  ['GET /api/slow', () => ok({ ok: true }, 3000)],
  ['POST /api/support', ({ body }) => ({ status: 201, body: { ticket: `SUP-${4000 + Math.floor(Math.random() * 999)}`, received: body?.message?.length ?? 0 } })],
  // Kept for older demos and tests.
  ['GET /api/user', () => ok({ id: 42, name: 'Ada', sessionToken: 'tok_live_123' })],
]

function match(pattern: string, method: string, path: string): Record<string, string> | undefined {
  const [patternMethod, patternPath] = pattern.split(' ') as [string, string]
  if (patternMethod !== method) return undefined
  const want = patternPath.split('/')
  const got = path.split('/')
  if (want.length !== got.length) return undefined
  const params: Record<string, string> = {}
  for (let i = 0; i < want.length; i++) {
    if (want[i]!.startsWith(':')) params[want[i]!.slice(1)] = decodeURIComponent(got[i]!)
    else if (want[i] !== got[i]) return undefined
  }
  return params
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : undefined)
      } catch {
        resolve(undefined)
      }
    })
  })
}

export function mockApi(): Plugin {
  return {
    name: 'mock-api',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        if (!url.pathname.startsWith('/api/')) return next()
        for (const [pattern, handler] of ROUTES) {
          const params = match(pattern, req.method ?? 'GET', url.pathname)
          if (!params) continue
          const reply = handler({ params, query: url.searchParams, body: await readBody(req) })
          res.statusCode = reply.status
          res.setHeader('content-type', 'application/json')
          setTimeout(() => res.end(reply.body === undefined ? '' : JSON.stringify(reply.body)), reply.delay ?? 120)
          return
        }
        res.statusCode = 404
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: `No route for ${req.method} ${url.pathname}` }))
      })
    },
  }
}
