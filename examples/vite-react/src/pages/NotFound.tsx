import { navigate } from '../router'
import { Button, EmptyState } from '../ui'

export function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <EmptyState title={`We couldn’t find that ${what}`} action={<Button variant="primary" onClick={() => navigate('/')}>Back to the shop</Button>}>
      It may have been moved or removed.
    </EmptyState>
  )
}
