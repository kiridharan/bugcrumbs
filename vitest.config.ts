import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const src = (pkg: string) => fileURLToPath(new URL(`./packages/${pkg}/src/index.ts`, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@bugcrumbs/core': src('core'),
      '@bugcrumbs/react': src('react'),
      '@bugcrumbs/query': src('query'),
      '@bugcrumbs/screenshot': src('screenshot'),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['packages/*/src/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
  },
})
