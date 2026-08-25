import { expect, test } from '@playwright/test'

test('good actor completes an alternate checkout verification', async ({ page }) => {
  await page.goto('/shopper')
  await page.getByRole('button', { name: /verify with your bank/i }).click()
  await expect(page.getByText(/your order is moving/i)).toBeVisible()
  await expect(page.getByText(/does not add a fraud label/i)).toBeVisible()
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
  await page.goto('/merchant')
  await page.getByRole('button', { name: /deny requires reason/i }).click()
  await page.getByLabel(/reviewer rationale/i).fill('Complete capture protocol shows an empty container and no expected serial.')
  await page.getByRole('checkbox', { name: /i reviewed the native evidence/i }).check()
  await page.getByRole('button', { name: /record deny decision/i }).click()
  await expect(page.getByText(/contest window is open/i)).toBeVisible()
  await page.goto('/shopper')
  await page.getByRole('tab', { name: /contest & appeal/i }).click()
  await page.getByRole('button', { name: /submit for a second human review/i }).click()
  await expect(page.getByText(/your evidence is preserved/i)).toBeVisible()
})

test('narrow lifecycle exposes the full decision contract without horizontal page overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop', 'Narrow-viewport assertion')
  await page.goto('/lifecycle')
  await expect(page.getByText('Native facts')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  expect(overflow).toBe(false)
})
