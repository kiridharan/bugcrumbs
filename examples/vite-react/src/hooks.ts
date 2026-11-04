import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Cart, type Me } from './api'
import { useToast } from './ui'

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/api/me') })
export const useCart = () => useQuery({ queryKey: ['cart'], queryFn: () => api<Cart>('/api/cart') })

/** Cart mutations share one pattern: update the cached cart and toast the outcome. */
function useCartMutation<V>(key: string, request: (variables: V) => Promise<Cart>, success?: (variables: V) => string) {
  const client = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationKey: ['cart', key],
    mutationFn: request,
    onSuccess: (cart, variables) => {
      client.setQueryData(['cart'], cart)
      if (success) toast(success(variables), 'success')
    },
    onError: (error) => toast(error.message, 'danger'),
  })
}

export const useAddToCart = () =>
  useCartMutation(
    'add',
    (input: { productId: number; name: string; qty?: number }) => api<Cart>('/api/cart/items', { method: 'POST', body: { productId: input.productId, qty: input.qty ?? 1 } }),
    (input) => `Added ${input.name} to your cart`,
  )

export const useUpdateQty = () => useCartMutation('update-qty', (input: { productId: number; qty: number }) => api<Cart>(`/api/cart/items/${input.productId}`, { method: 'PATCH', body: { qty: input.qty } }))

export const useRemoveFromCart = () =>
  useCartMutation(
    'remove',
    (input: { productId: number; name: string }) => api<Cart>(`/api/cart/items/${input.productId}`, { method: 'DELETE' }),
    (input) => `Removed ${input.name}`,
  )
