# @bugcrumbs/query

TanStack Query adapter for [Bugcrumbs](https://github.com/kiridharan/bugcrumbs). Failed queries and mutations appear in bug reports with their key, status and error.

```bash
npm i @bugcrumbs/query
```

```ts
import { trackQueryClient } from '@bugcrumbs/query'

trackQueryClient(queryClient)
```

It records nothing unless Bugcrumbs is enabled. MIT licence.
