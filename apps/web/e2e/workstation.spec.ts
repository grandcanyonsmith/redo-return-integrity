import { expect, test, type Page } from '@playwright/test'

/** The Home / Scan / Board panels stay mounted; only the active one is visible. */
const visibleWork = (page: Page) => page.locator('.ws-frame > div:not([hidden])')

/** Signs in with the seeded demo operator; every test starts logged out. */
async function loginAsOperator(page: Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: /STN-04 · PIN 0404/i }).click()
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await expect(page.getByRole('heading', { name: /refund dashboard/i })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('link', { name: /^scan$/i }).click()
  await expect(page.getByRole('heading', { name: /no returns scanned|ready for the next box/i })).toBeVisible({ timeout: 15_000 })
}

/** Runs S0→S3 against the live in-process API: login, start a scan, use the
 * demo label, and wait for the MCP lookup match. */
async function matchDemoLabel(page: Page) {
  await loginAsOperator(page)
  await page.getByRole('button', { name: /scan return label/i }).click()
  await page.getByRole('button', { name: /use the demo label/i }).click()
  await expect(page.getByText(/return matched by label/i)).toBeVisible({ timeout: 15_000 })
}

async function analyzeFixture(page: Page, thumb: RegExp) {
  await page.getByRole('button', { name: /open box & photograph/i }).click()
  await page.getByRole('button', { name: thumb }).click()
  await expect(page.locator('.ws-assess-head .ws-chip').first()).toBeVisible({ timeout: 15_000 })
}

test('login gates the workstation, rejects a bad PIN, and logout returns to sign-in', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: /station sign in/i })).toBeVisible()

  await page.getByLabel(/station id/i).fill('STN-04')
  await page.getByLabel(/^pin$/i).fill('9999')
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await expect(page.getByText(/did not match/i)).toBeVisible({ timeout: 15_000 })

  await page.getByLabel(/^pin$/i).fill('0404')
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await expect(page.getByRole('heading', { name: /refund dashboard/i })).toBeVisible({ timeout: 15_000 })
  // The operator's name text hides below 480px; the controls remain on all sizes.
  await expect(page.getByRole('button', { name: /station settings/i })).toBeVisible()
  await page.getByRole('link', { name: /^scan$/i }).click()
  await expect(page.getByRole('heading', { name: /no returns scanned/i })).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: /log out/i }).click()
  await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 })
})

test('workstation happy path: scan → match → inspect → triage pass → act → send → activity logged', async ({ page }) => {
  await matchDemoLabel(page)
  await expect(visibleWork(page).getByText('RMA-8821')).toBeVisible()

  await analyzeFixture(page, /qty mismatch/i)
  await expect(page.locator('.ws-assess-head .ws-chip')).toContainText('QUANTITY MISMATCH')
  await expect(page.locator('summary').filter({ hasText: /model audit/i })).toBeVisible()
  await expect(page.getByText(/refund math/i).first()).toBeVisible()
  await expect(page.getByText(/next-step recommendation/i)).toBeVisible()

  await page.getByRole('button', { name: /choose next step/i }).click()
  await expect(page.getByRole('radio', { name: /pass/i }).first()).toBeChecked()
  await page.getByRole('button', { name: /confirm: pass/i }).click()

  await expect(page.getByRole('radio', { name: /approve partial refund/i })).toBeChecked({ timeout: 15_000 })
  await page.getByRole('button', { name: /draft message/i }).click()
  await expect(page.getByText(/update on return rma-8821/i)).toBeVisible({ timeout: 15_000 })
  const send = page.getByRole('button', { name: /send to customer/i })
  await expect(send).toBeDisabled()
  await page.getByRole('checkbox', { name: /approve as written/i }).check()
  await send.click()

  await expect(page.getByRole('heading', { name: /queued & logged/i })).toBeVisible({ timeout: 15_000 })
  await expect(visibleWork(page).getByText('PARTIAL REFUND PENDING')).toBeVisible()

  // Timeline entries carry mini evidence thumbnails and operator attribution.
  await expect(page.locator('.ws-timeline__thumb').first()).toBeVisible()
  await expect(page.locator('.ws-timeline__by').first()).toHaveText(/station 04 operator/i)

  await page.getByRole('button', { name: /back to home/i }).click()
  await expect(page.getByRole('heading', { name: /refund dashboard/i })).toBeVisible()
  await expect(visibleWork(page).getByRole('button', { name: /ava morgan rma-8821/i })).toContainText(/this session|refunded|partial/i, { timeout: 15_000 })
})

const branches = [
  { thumb: /^match$/i, chip: 'MATCH', disposition: /pass/i },
  { thumb: /empty box/i, chip: 'EMPTY BOX', disposition: /set aside/i },
  { thumb: /wrong product/i, chip: 'WRONG PRODUCT', disposition: /set aside/i },
  { thumb: /damaged/i, chip: 'DAMAGED PRODUCT', disposition: /take more photos/i },
  { thumb: /imitation/i, chip: 'POSSIBLE IMITATION', disposition: /set aside/i },
] as const

for (const branch of branches) {
  test(`workstation branch: ${branch.chip} triage recommends the right disposition`, async ({ page }) => {
    await matchDemoLabel(page)
    await analyzeFixture(page, branch.thumb)
    await expect(page.locator('.ws-assess-head .ws-chip')).toContainText(branch.chip)

    await page.getByRole('button', { name: /choose next step/i }).click()
    await expect(page.getByRole('radio', { name: branch.disposition }).first()).toBeChecked()
    await expect(page.getByText(/ai recommends|station setting/i)).toBeVisible()
  })
}

test('pass triage continues to server-derived action options', async ({ page }) => {
  await matchDemoLabel(page)
  await analyzeFixture(page, /^match$/i)
  await page.getByRole('button', { name: /choose next step/i }).click()
  await page.getByRole('button', { name: /confirm: pass/i }).click()
  await expect(page.getByRole('radio', { name: /approve full refund/i })).toBeChecked({ timeout: 15_000 })
})

test('take-more-photos triage loops back with a guided shot list and escalates at the retake cap', async ({ page }) => {
  await matchDemoLabel(page)
  await analyzeFixture(page, /damaged/i)
  await page.getByRole('button', { name: /choose next step/i }).click()
  await expect(page.getByRole('radio', { name: /take more photos/i })).toBeChecked()
  await expect(page.getByText(/close-up of the damaged area/i).first()).toBeVisible()
  await page.getByRole('button', { name: /confirm: take more photos/i }).click()

  // Back at the contents viewfinder with the retake instructions banner.
  await expect(page.getByText(/retake 1 — capture next/i)).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /damaged/i }).click()
  await expect(page.locator('.ws-assess-head .ws-chip')).toContainText('DAMAGED PRODUCT', { timeout: 15_000 })
  await page.getByRole('button', { name: /choose next step/i }).click()
  await page.getByRole('button', { name: /confirm: take more photos/i }).click()

  // Second retake exhausts the default budget (2): the next assessment
  // recommends set-aside instead of more photos.
  await expect(page.getByText(/retake 2 — capture next/i)).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /damaged/i }).click()
  await expect(page.locator('.ws-assess-head .ws-chip')).toContainText('DAMAGED PRODUCT', { timeout: 15_000 })
  await page.getByRole('button', { name: /choose next step/i }).click()
  await expect(page.getByRole('radio', { name: /set aside/i })).toBeChecked()
  await expect(page.getByText(/retake limit/i).first()).toBeVisible()
})

test('set-aside records the disposition, then a simulated call resolves it and triggers the post-call MCP log', async ({ page }) => {
  await matchDemoLabel(page)
  await analyzeFixture(page, /wrong product/i)
  await page.getByRole('button', { name: /choose next step/i }).click()
  await expect(page.getByRole('radio', { name: /set aside/i })).toBeChecked()
  await page.getByRole('button', { name: /confirm: set aside/i }).click()

  await expect(page.getByRole('heading', { name: /set aside & logged/i })).toBeVisible({ timeout: 15_000 })
  await expect(visibleWork(page).locator('.ws-chip').filter({ hasText: /^SET ASIDE$/ })).toBeVisible()

  await page.getByRole('button', { name: /call customer now/i }).click()
  await expect(page.getByText(/simulated call · no openai key/i)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/no real telephone call is placed/i)).toBeVisible()
  await expect(page.locator('.ws-call-turn').first()).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: /end call/i }).click()
  await expect(page.getByText(/call outcome/i).first()).toBeVisible()
  await page.getByRole('radio', { name: /customer will ship the item back/i }).check()
  await page.getByLabel(/note/i).fill('Customer mixed up two returns.')
  await page.getByRole('button', { name: /record outcome & log/i }).click()

  await expect(visibleWork(page).getByText('AWAITING CUSTOMER')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/transcript digest/i)).toBeVisible()
  await expect(page.getByText(/call outcome recorded · record updated/i).first()).toBeVisible()

  await page.getByRole('button', { name: /back to home/i }).click()
  await expect(page.getByRole('heading', { name: /refund dashboard/i })).toBeVisible()
  await expect(visibleWork(page).getByRole('button', { name: /ava morgan rma-8821/i })).toContainText(/this session|awaiting customer|set aside/i, { timeout: 15_000 })
})

test('station settings change the server-side triage recommendation', async ({ page }) => {
  await loginAsOperator(page)
  await page.getByRole('button', { name: /station settings/i }).click()
  await expect(page.getByRole('heading', { name: /station settings/i })).toBeVisible()

  await page.getByLabel(/handling for match/i).click()
  await page.getByRole('option', { name: /always set aside/i }).click()
  await page.getByRole('button', { name: /save settings/i }).click()
  await expect(page.getByRole('button', { name: /saved/i })).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: /workstation/i }).click()
  await expect(page.getByRole('heading', { name: /refund dashboard/i })).toBeVisible()
  await page.getByRole('link', { name: /^scan$/i }).click()
  await page.getByRole('button', { name: /scan return label/i }).click()
  await page.getByRole('button', { name: /use the demo label/i }).click()
  await expect(page.getByText(/return matched by label/i)).toBeVisible({ timeout: 15_000 })
  await analyzeFixture(page, /^match$/i)

  await expect(page.getByText(/station setting/i).first()).toBeVisible()
  await page.getByRole('button', { name: /choose next step/i }).click()
  await expect(page.getByRole('radio', { name: /set aside/i })).toBeChecked()
  await expect(page.getByText(/station setting/i).first()).toBeVisible()
})

test('workstation home is an empty state and manual entry path exists', async ({ page }) => {
  await loginAsOperator(page)
  await expect(page.getByRole('heading', { name: /no returns scanned/i })).toBeVisible()
  await expect(page.locator('p.ws-activity__empty:visible')).toHaveText(/nothing yet today/i)

  await page.getByRole('button', { name: /scan return label/i }).click()
  await page.getByRole('button', { name: /enter rma, order # or tracking/i }).click()
  await page.getByLabel(/return identifier/i).fill('RMA-8821')
  await page.getByRole('button', { name: /search returns/i }).click()
  await expect(page.getByText(/return matched by/i)).toBeVisible({ timeout: 15_000 })
})

test('workstation fits a 320px viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await loginAsOperator(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  expect(overflow).toBe(false)
})

test('home dashboard and board show refund stats and a full case journey', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: /STN-04 · PIN 0404/i }).click()
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await expect(page.getByRole('heading', { name: /refund dashboard/i })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/total refunds/i)).toBeVisible()
  await expect(page.getByText(/amount processed/i)).toBeVisible()
  const home = visibleWork(page)
  await expect(home.getByText(/time saved with ai/i)).toBeVisible()
  await expect(home.getByText(/wrongful refunds saved/i)).toBeVisible()
  await expect(page.getByRole('grid', { name: /august/i })).toBeVisible()

  await page.getByRole('link', { name: /fraudulent attempts/i }).click()
  const fraud = visibleWork(page)
  await expect(fraud.getByRole('heading', { name: /fraudulent attempts/i })).toBeVisible()
  await expect(fraud.getByRole('heading', { name: /empty boxes/i })).toBeVisible()
  await expect(fraud.getByRole('heading', { name: /decoy returns/i })).toBeVisible()
  await expect(fraud.getByRole('heading', { name: /damaged goods/i })).toBeVisible()
  await expect(fraud.getByRole('heading', { name: /good quantity/i })).toBeVisible()
  await expect(fraud.getByText(/\$5,547\.00/)).toBeVisible()

  await page.getByRole('link', { name: /^board$/i }).click()
  await expect(page.getByRole('heading', { name: /return board/i })).toBeVisible()
  await expect(page.getByRole('listitem', { name: /refunded/i })).toBeVisible()
  await page.getByRole('button', { name: /noah chen/i }).click()
  await expect(page.getByRole('dialog', { name: /noah chen/i })).toBeVisible()
  await expect(page.getByText(/checkout jc-1099/i)).toBeVisible()
  await expect(page.getByText(/pick · pack · label/i)).toBeVisible()
  await expect(page.getByText(/inbound weight/i)).toBeVisible()
  await expect(page.getByText(/ai email queued/i)).toBeVisible()
})
