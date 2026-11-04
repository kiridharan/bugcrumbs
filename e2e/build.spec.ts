import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('the published core build leaves NODE_ENV for the app’s bundler (FR-23)', async () => {
  // If the library build inlines NODE_ENV, the production warning can never fire in apps.
  const dist = await readFile(new URL('../packages/core/dist/index.js', import.meta.url), 'utf8')
  expect(dist).toContain('process.env.NODE_ENV === "production"')
})
