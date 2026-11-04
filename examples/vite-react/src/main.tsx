import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { startCapture } from '@bugcrumbs/core'
import { trackQueryClient } from '@bugcrumbs/query'
import { BugcrumbsDevtools, bugcrumbsRootOptions } from '@bugcrumbs/react'
import { App } from './App'
import { ToastProvider } from './ui'
import './styles.css'

// Start before rendering so the very first requests are captured too.
startCapture({ enabled: import.meta.env.VITE_BUGCRUMBS })

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })
trackQueryClient(queryClient)

createRoot(document.getElementById('root')!, bugcrumbsRootOptions()).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
      </ToastProvider>
      <BugcrumbsDevtools
        enabled={import.meta.env.VITE_BUGCRUMBS}
        fields={{
          custom: [{ id: 'area', label: 'Area', type: 'select', options: ['Shop', 'Cart & checkout', 'Orders', 'Account', 'Dashboard', 'Other'] }],
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
)
