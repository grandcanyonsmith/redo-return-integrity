import { expect, test } from '@playwright/test'

test('good actor completes an alternate checkout verification', async ({ page }) => {
  await page.goto('/shopper')
  await page.getByRole('button', { name: /verify with your bank/i }).click()
  await expect(page.getByText(/your order is moving/i)).toBeVisible()
  await expect(page.getByText(/does not add a fraud label/i)).toBeVisible()
})

test('dashboard tasks open the exact shopper journey', async ({ page }) => {
  await page.goto('/legacy')
  await page.getByRole('link', { name: /impossible logistics/i }).click()
  await expect(page).toHaveURL(/\/legacy\/shopper\?journey=return$/)
  await expect(page.getByRole('tab', { name: /return handoff/i })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel', { name: /return handoff/i })).toBeVisible()
})

test('warehouse review does not preselect a discrepancy or auto-present a model result', async ({ page }) => {
  await page.goto('/operator')
  await expect(page.getByRole('radio', { name: /^empty$/i })).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByText(/no discrepancy classification is selected/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /select a native finding first/i })).toBeDisabled()
  await expect(page.getByText(/no live output yet/i)).toBeVisible()
})

test('merchant review stays locked until a neutral warehouse observation is routed', async ({ page }) => {
  await page.goto('/merchant')
  await expect(page.getByRole('heading', { name: /operator review required/i })).toBeVisible()
  await expect(page.getByText(/corroborated finding/i)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /deny requires reason/i })).toHaveCount(0)
})

test('impossible logistics is cured with a receipt image', async ({ page }) => {
  await page.goto('/shopper')
  await page.getByRole('tab', { name: /return handoff/i }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'staffed-receipt.png', mimeType: 'image/png', buffer: Buffer.from('fixture') })
  await page.getByRole('button', { name: /match receipt and continue/i }).click()
  await expect(page.getByText(/receipt matched return/i)).toBeVisible()
  await expect(page.getByText(/no adverse label was applied/i)).toBeVisible()
})

test('adverse return outcome requires a human and opens shopper appeal', async ({ page }) => {
  await page.goto('/operator')
  await page.getByRole('radio', { name: /^empty$/i }).click()
  await page.getByRole('checkbox', { name: /i reviewed the completed capture protocol/i }).check()
  await page.getByRole('button', { name: /confirm finding & route to merchant/i }).click()
  await page.goto('/merchant')
  await page.getByRole('button', { name: /deny requires reason/i }).click()
  await page.getByLabel(/reviewer rationale/i).fill('Complete capture protocol shows an empty container and no expected serial.')
  await page.getByRole('checkbox', { name: /i reviewed the native evidence/i }).check()
  await page.getByRole('button', { name: /record deny decision/i }).click()
  await expect(page.getByText(/contest window is open/i)).toBeVisible()
  await page.goto('/shopper')
  await page.getByRole('tab', { name: /contest & appeal/i }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'appeal-proof.png', mimeType: 'image/png', buffer: Buffer.from('fixture') })
  await page.getByRole('button', { name: /submit for a second human review/i }).click()
  await expect(page.getByText(/your appeal details are recorded/i)).toBeVisible()
  await expect(page.getByText('appeal-proof.png')).toBeVisible()
  await page.reload()
  await expect(page.getByText(/your appeal details are recorded/i)).toBeVisible()
  await expect(page.getByText('appeal-proof.png')).toBeVisible()
})

test('dashboard and evaluation lab fit a 320px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  for (const path of ['/legacy', '/legacy/lab']) {
    await page.goto(path)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    expect(overflow, `${path} should not overflow horizontally`).toBe(false)
  }
})

test('narrow lifecycle exposes the full decision contract without horizontal page overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop', 'Narrow-viewport assertion')
  await page.goto('/lifecycle')
  await expect(page.getByText('Native facts').first()).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  expect(overflow).toBe(false)
})

test('merchant scans a test label and receives a human-gated structured inspection', async ({ page }) => {
  await page.goto('/intake')
  await expect(page.locator('input[type=file][capture=environment]')).toHaveCount(1)
  await page.getByRole('button', { name: /run synthetic label tool/i }).click()
  await expect(page.getByText(/return record matched/i)).toBeVisible()
  await expect(page.locator('input[type=file][capture=environment]')).toHaveCount(2)
  await expect(page.getByRole('region', { name: /merchant policy snapshot/i })).toContainText('skims-returns')
  await expect(page.getByRole('region', { name: /merchant policy snapshot/i })).toContainText('USD')
  await page.getByRole('button', { name: /analyze contents against order/i }).click()
  await expect(page.getByText(/schema-validated output/i)).toBeVisible()
  await expect(page.getByRole('heading', { name: /empty box/i })).toBeVisible()
  await expect(page.getByRole('region', { name: /inspection request and response/i })).toContainText('store: false')
  await page.getByRole('button', { name: /generate email preview/i }).click()
  await expect(page.getByText(/email preview/i)).toBeVisible()
  await expect(page.getByLabel(/approve as written draft binding/i)).toContainText('APPROVE_AS_WRITTEN')
  await expect(page.getByText(/unauthenticated display label only/i)).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  expect(overflow).toBe(false)
  await page.getByRole('checkbox', { name: /i reviewed the source images/i }).check()
  await page.getByRole('button', { name: /persist human review/i }).click()
  // The dev server hosts the Lambda API in-process, so the review persists.
  await expect(page.getByText(/review persisted · no funds moved/i)).toBeVisible()
  await page.getByRole('button', { name: /queue test shopper message/i }).click()
  await expect(page.getByText(/queued in test outbox/i)).toBeVisible()
})

test('interactive tools gallery advances in-frame and deep-links to the full journeys', async ({ page }) => {
  await page.goto('/tools')
  await expect(page.getByRole('tab', { name: /operations/i })).toHaveAttribute('aria-selected', 'true')

  await page.getByRole('button', { name: /preview label lookup/i }).click()
  await expect(page.getByRole('heading', { name: /return preview found/i })).toBeVisible()
  await page.getByRole('button', { name: /continue from label lookup to inspect package/i }).click()
  await expect(page).toHaveURL(/category=operations&demo=inspect-contents/)

  await page.getByRole('button', { name: /quantity mismatch/i }).click()
  await page.getByRole('button', { name: /analyze contents/i }).click()
  await expect(page.getByText('QUANTITY_MISMATCH')).toBeVisible()
  await expect(page.getByText('$924.50 refund')).toBeVisible()

  await page.getByRole('tab', { name: /shopper/i }).click()
  await expect(page.getByRole('heading', { name: /one quick check before we ship/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /^open checkout journey$/i })).toHaveAttribute('href', '/legacy/shopper?journey=checkout')

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  expect(overflow).toBe(false)
})
