export type Category = 'coffee' | 'tea' | 'brewing' | 'gear'

export interface Product {
  id: number
  name: string
  category: Category
  price: number
  rating: number
  reviews: number
  stock: number
  color: string
  description: string
  specs: Record<string, string>
}

export interface Review {
  id: number
  author: string
  rating: number
  date: string
  text: string
}

export interface Cart {
  items: { productId: number; qty: number; product: Product }[]
  count: number
  subtotal: number
}

export interface OrderSummary {
  id: number
  date: string
  status: 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled'
  items: { productId: number; name: string; price: number; qty: number }[]
  total: number
}

export interface Order extends OrderSummary {
  address: { name: string; line1: string; city: string; postcode: string; country: string }
}

export interface Me {
  id: number
  name: string
  email: string
  company: string
  plan: string
}

export interface Stats {
  range: string
  revenue: number
  orders: number
  averageOrder: number
  conversion: number
  deltas: Record<'revenue' | 'orders' | 'averageOrder' | 'conversion', number>
  series: { day: string; revenue: number; orders: number }[]
  topProducts: { id: number; name: string; units: number; revenue: number }[]
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: { error?: string; errors?: Record<string, string> },
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** JSON API client. Every request carries the demo bearer token, which Bugcrumbs must redact. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? 'GET',
    headers: { 'content-type': 'application/json', authorization: 'Bearer demo-token' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : undefined
  if (!response.ok) throw new ApiError(response.status, `${data?.error ?? 'Request failed'} (HTTP ${response.status})`, data)
  return data as T
}

export const money = (value: number): string => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value)
export const shortDate = (iso: string): string => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
