import { readFile, writeFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

/** Values the demo puts in forms, headers and responses; none may appear in a report. */
const SECRETS = ['4242 4242 4242 4242', 'hunter2', 'demo-token', 'tok_live_123']

/** Waits until the demo shop has loaded the signed-in user. */
async function ready(page: Page) {
  await expect(page.getByRole('link', { name: 'Account for Ada Lovelace' })).toBeVisible()
}

/** Produces 5 failures: a failed payment (request + mutation), a failed query (request + query) and a console error. */
async function breakThings(page: Page) {
  await page.goto('/checkout')
  await ready(page)
  await page.getByRole('button', { name: 'Place order' }).click()
  await expect(page.getByText('Payment provider timeout (HTTP 500)')).toBeVisible()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'QA lab' }).click()
  await page.getByRole('button', { name: 'Fail a query' }).click()
  await expect(page.getByText('Inventory: error')).toBeVisible()
  await page.getByRole('button', { name: 'Log error' }).click()
  await page.getByRole('button', { name: 'Open magic link' }).click()
  await expect(page.getByRole('heading', { name: 'Order #1042' })).toBeVisible()
}

async function openPanel(page: Page) {
  await page.getByRole('button', { name: /^Bugcrumbs, \d+ failures$/ }).click()
  await expect(page.getByRole('dialog', { name: 'Report a bug' })).toBeVisible()
}

async function fillForm(page: Page) {
  await page.getByLabel(/^Title/).fill('Checkout fails with a 500')
  await page.getByLabel(/^What happened/).fill('Clicked Place order and got an error.')
  await page.getByLabel('Severity').selectOption('high')
}

test('a tester files a complete HTML report with nothing sensitive in it (FR-01–FR-09, FR-13, FR-14)', async ({ page }) => {
  await breakThings(page)
  await expect(page.getByRole('button', { name: 'Bugcrumbs, 5 failures' })).toBeVisible()
  await openPanel(page)
  await fillForm(page)

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download HTML report' }).click()])
  expect(download.suggestedFilename()).toMatch(/^bugcrumbs-checkout-fails-with-a-500-.*\.html$/)
  const html = await readFile((await download.path())!, 'utf8')

  for (const text of [
    'Checkout fails with a 500',
    'POST http://localhost:5199/api/orders → 500',
    'Payment provider timeout',
    'GET http://localhost:5199/api/inventory → 503',
    'mutation [&quot;place-order&quot;]',
    'query [&quot;inventory&quot;,{&quot;warehouse&quot;:&quot;eu-1&quot;}]',
    'Price mismatch',
    'Clicked button &quot;Place order&quot;',
    'Navigated to /orders/',
    '[redacted]',
  ]) {
    expect(html, text).toContain(text)
  }
  for (const secret of SECRETS) expect(html, `leaked ${secret}`).not.toContain(secret)
  expect(html).toContain('session=%5Bredacted%5D')

  // The JSON block round-trips, and the report has no scripts that execute.
  const json = JSON.parse(html.split('id="bugcrumbs-report">')[1]!.split('</script>')[0]!)
  expect(json.form).toMatchObject({ title: 'Checkout fails with a 500', severity: 'high' })
  expect(html.match(/<script/g)).toHaveLength(1)
})

test('the screenshot shows the viewport, masks card fields and leaves the page untouched (FR-09)', async ({ page }, testInfo) => {
  await page.goto('/checkout')
  await ready(page)
  await page.getByLabel('Card number').scrollIntoViewIfNeeded()
  const iframesBefore = await page.locator('iframe').count()
  await openPanel(page)

  await page.getByRole('button', { name: 'Take screenshot' }).click()
  const preview = page.getByRole('img', { name: 'Screenshot of the page' })
  await expect(preview).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText('Screenshot added')
  await expect(page.getByRole('button', { name: 'Copy image' })).toBeFocused()

  const shot = await preview.evaluate(async (img: HTMLImageElement) => {
    const bytes = new Uint8Array(await (await fetch(img.src)).arrayBuffer())
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return { base64: btoa(binary), width: img.naturalWidth, height: img.naturalHeight }
  })
  const viewport = page.viewportSize()!
  expect(shot).toMatchObject({ width: viewport.width, height: viewport.height })
  await writeFile(testInfo.outputPath('screenshot.png'), Buffer.from(shot.base64, 'base64'))
  if (process.env.BUGCRUMBS_SHOT_DIR) await writeFile(`${process.env.BUGCRUMBS_SHOT_DIR}/top.png`, Buffer.from(shot.base64, 'base64'))

  // The library's helper iframe is removed, and live inputs keep their values.
  expect(await page.locator('iframe').count()).toBe(iframesBefore)
  await expect(page.getByLabel('Card number')).toHaveValue('4242 4242 4242 4242')
})

test('the screenshot follows the scroll position (FR-09)', async ({ page }) => {
  await page.goto('/orders')
  await expect(page.getByRole('link', { name: 'Order #1017' })).toBeVisible()
  await page.locator('#bottom-marker').scrollIntoViewIfNeeded()
  await openPanel(page)
  await page.getByRole('button', { name: 'Take screenshot' }).click()
  const preview = page.getByRole('img', { name: 'Screenshot of the page' })
  await expect(preview).toBeVisible({ timeout: 20_000 })
  const base64 = await preview.evaluate(async (img: HTMLImageElement) => {
    const bytes = new Uint8Array(await (await fetch(img.src)).arrayBuffer())
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  })
  if (process.env.BUGCRUMBS_SHOT_DIR) await writeFile(`${process.env.BUGCRUMBS_SHOT_DIR}/scrolled.png`, Buffer.from(base64, 'base64'))
})

test('Copy for AI puts a prompt-shaped report on the clipboard, by keyboard only (FR-15)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await breakThings(page)

  const toggle = page.getByRole('button', { name: /^Bugcrumbs, \d+ failures$/ })
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel(/^Title/)).toBeFocused()
  await fillForm(page)
  await page.getByRole('button', { name: 'Copy for AI' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText('Copied for AI — paste it into Claude, Cursor or Copilot')

  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toMatch(/^I need help fixing a bug/)
  expect(text).toContain('## Failed requests')
  for (const secret of SECRETS) expect(text).not.toContain(secret)

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(toggle).toBeFocused()
})

test('Bugcrumbs records nothing about its own screenshot requests', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await expect(page.getByRole('link', { name: 'Gooseneck Kettle' }).first()).toBeVisible()
  await openPanel(page)
  await page.getByRole('button', { name: 'Take screenshot' }).click()
  await expect(page.getByRole('img', { name: 'Screenshot of the page' })).toBeVisible({ timeout: 20_000 })
  await fillForm(page)

  await page.getByText('More formats').click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download JSON' }).click()])
  const report = JSON.parse(await readFile((await download.path())!, 'utf8'))
  const urls = report.entries.filter((entry: { kind: string }) => entry.kind === 'network').map((entry: { url: string }) => entry.url)
  // Only the app's own API calls: none of the image or font fetches made for the screenshot.
  expect(urls.length).toBeGreaterThan(0)
  for (const url of urls) expect(url).toMatch(/^http:\/\/localhost:5199\/api\//)
  expect(report.screenshot).toMatch(/^data:image\/png;base64,/)
})

test('saved bugs survive a reload and export as one CSV; the screenshot copies as an image (FR-09, FR-16)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await breakThings(page)
  await openPanel(page)

  await page.getByRole('button', { name: 'Take screenshot' }).click()
  await expect(page.getByRole('img', { name: 'Screenshot of the page' })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Copy image' }).click()
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText('Screenshot copied — paste it into your ticket or chat')
  const types = await page.evaluate(async () => (await navigator.clipboard.read()).flatMap((item) => item.types))
  expect(types).toContain('image/png')

  await fillForm(page)
  await page.getByRole('button', { name: 'Save and start next' }).click()
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText(/^Saved “Checkout fails with a 500”/)
  await expect(page.getByRole('button', { name: /^Bugcrumbs, 0 failures$/ })).toBeVisible()

  await page.reload()
  await ready(page)
  await openPanel(page)
  await expect(page.getByText('Saved bugs (1)')).toBeVisible()

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export 1 bug as CSV' }).click()])
  expect(download.suggestedFilename()).toMatch(/^bugcrumbs-.*\.csv$/)
  const csv = await readFile((await download.path())!, 'utf8')
  expect(csv).toContain('"Checkout fails with a 500","Bug","High"')
  expect(csv).toContain('POST http://localhost:5199/api/orders → 500')
  for (const secret of SECRETS) expect(csv, `leaked ${secret}`).not.toContain(secret)

  await page.getByRole('button', { name: 'Delete all' }).click()
  await page.getByRole('button', { name: 'Confirm delete all' }).click()
  await expect(page.getByText(/^Saved bugs/)).toBeHidden()
})
