import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { newDemoState, type DemoState } from './domain'
import { DemoProvider } from './lib/demo-context'

function renderAt(path: string, statePatch: Partial<DemoState> = {}, options: { operator?: boolean } = {}) {
  sessionStorage.clear()
  sessionStorage.setItem('redo-return-integrity:demo:v1', JSON.stringify({ ...newDemoState(), ...statePatch }))
  if (options.operator) {
    sessionStorage.setItem('redo-return-integrity:operator:v1', JSON.stringify({
      operatorId: 'op-stn-04',
      stationId: 'STN-04',
      displayName: 'Station 04 operator',
      role: 'OPERATOR',
      identityAssurance: 'DEMO_STATION_PIN',
      loggedInAt: '2026-08-29T12:00:00.000Z',
    }))
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <DemoProvider><App /></DemoProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('interview demo', () => {
  it('lets a good actor clear the checkout challenge without a fraud label', async () => {
    renderAt('/shopper')
    await userEvent.click(screen.getByRole('button', { name: /email \+ payment check/i }))
    expect(screen.getByText(/your order is moving/i)).toBeInTheDocument()
    expect(screen.getByText(/does not add a fraud label/i)).toBeInTheDocument()
  })

  it('renders all lifecycle checkpoints with a complete first pipeline', () => {
    renderAt('/lifecycle')
    expect(screen.getByTestId('checkpoint-VISIT_SESSION')).toBeInTheDocument()
    expect(screen.getAllByText('Native facts').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Shopper cure').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Accountable action').length).toBeGreaterThan(0)
  })

  it('restores lifecycle deep links and keeps one clear checkpoint selected', async () => {
    renderAt('/lifecycle?checkpoint=IDENTITY_LINK')

    expect(screen.getByRole('heading', { name: /^identity link$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /02 identity/i })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: /^purchase$/i })).toHaveAttribute('aria-pressed', 'true')
    const identityContract = within(screen.getByTestId('checkpoint-IDENTITY_LINK'))
    expect(identityContract.getByText(/^evidence$/i)).toBeInTheDocument()
    expect(identityContract.getByText(/^assessment$/i)).toBeInTheDocument()
    expect(identityContract.getByText(/^decision$/i)).toBeInTheDocument()
    expect(identityContract.getByText(/^shopper path$/i)).toBeInTheDocument()
    expect(screen.getByText(/view model rationale, sources, and audit details/i).closest('details')).not.toHaveAttribute('open')

    await userEvent.click(screen.getByRole('button', { name: /^fulfillment$/i }))
    expect(screen.getByTestId('checkpoint-OUTBOUND_PACK')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /05 pack/i })).toHaveAttribute('aria-current', 'step')
  })

  it('preserves an active coverage filter while moving between matching checkpoints', async () => {
    renderAt('/lifecycle')
    await userEvent.selectOptions(screen.getByLabelText(/coverage/i), 'Managed network')
    expect(screen.getByText(/no checkpoints in this view/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^fulfillment$/i }))
    expect(screen.getByTestId('checkpoint-OUTBOUND_PACK')).toBeInTheDocument()
    expect(screen.getByLabelText(/coverage/i)).toHaveValue('Managed network')
    await userEvent.click(screen.getByRole('button', { name: /next receive/i }))
    expect(screen.getByTestId('checkpoint-WAREHOUSE_RECEIPT')).toBeInTheDocument()
    expect(screen.getByLabelText(/coverage/i)).toHaveValue('Managed network')
  })

  it('moves focus into the mobile menu and contains keyboard navigation', async () => {
    renderAt('/merchant')
    const toggle = screen.getByRole('button', { name: /open navigation/i })
    const dashboard = screen.getByRole('link', { name: /^dashboard$/i })

    await userEvent.click(toggle)
    await waitFor(() => expect(dashboard).toHaveFocus())
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
    expect(toggle).toHaveFocus()
    await userEvent.keyboard('{Tab}')
    expect(dashboard).toHaveFocus()
    await userEvent.click(screen.getByRole('link', { name: /^merchant$/i }))
    await waitFor(() => expect(toggle).toHaveFocus())
  })

  it('requires a reason and certification before recording a human denial', async () => {
    renderAt('/merchant', { physical: 'review-pending' })
    await userEvent.click(screen.getByRole('button', { name: /deny requires reason/i }))
    const record = screen.getByRole('button', { name: /record deny decision/i })
    expect(record).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/reviewer rationale/i), 'Inspection sequence is complete and no expected item is visible.')
    await userEvent.click(screen.getByRole('checkbox', { name: /i reviewed the native evidence/i }))
    expect(record).toBeEnabled()
  })

  it('runs the synthetic return-intake workflow without implying a production send', async () => {
    renderAt('/intake')
    const cameraInputs = document.querySelectorAll('input[type="file"][capture="environment"]')
    expect(cameraInputs).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: /run synthetic label tool/i }))
    expect(await screen.findByText(/return record matched/i)).toBeInTheDocument()
    expect(document.querySelectorAll('input[type="file"][capture="environment"]')).toHaveLength(2)
    const policySnapshot = screen.getByRole('region', { name: /merchant policy snapshot/i })
    expect(policySnapshot).toHaveTextContent('skims-returns')
    expect(policySnapshot).toHaveTextContent('seeded-policy-1')
    expect(policySnapshot).toHaveTextContent('USD')
    expect(policySnapshot).toHaveTextContent('92fe5169bc20d5bd60814c9cddd6384586c85ba7b8f119e6cc787c8d449e4da6')

    await userEvent.click(screen.getByRole('button', { name: /analyze contents against order/i }))
    expect(await screen.findByRole('heading', { name: /empty box/i })).toBeInTheDocument()
    expect(screen.getByText(/schema-validated output/i)).toBeInTheDocument()
    expect(screen.getAllByText(/original purchased sku/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/warehouse evidence/i).length).toBeGreaterThan(0)
    const inspectionAudit = screen.getByRole('region', { name: /inspection request and response/i })
    expect(inspectionAudit).toHaveTextContent('SYNTHETIC_FIXTURE')
    expect(inspectionAudit).toHaveTextContent('synthetic-fixture-inspector-1.0')
    expect(inspectionAudit).toHaveTextContent('store: false')
    expect(inspectionAudit).toHaveTextContent('0'.repeat(64))

    const recordReview = screen.getByRole('button', { name: /generate the message preview first/i })
    expect(recordReview).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: /generate email preview/i }))
    expect(await screen.findByText(/email preview/i)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /shopper-message draft request and response/i })).toHaveTextContent('SAFE_FALLBACK')
    expect(screen.getByLabelText(/approve as written draft binding/i)).toHaveTextContent('APPROVE_AS_WRITTEN')
    expect(screen.getByLabelText(/approve as written draft binding/i)).toHaveTextContent('0'.repeat(64))
    expect(screen.getByText(/unauthenticated display label only/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: /i reviewed the source images/i }))
    await userEvent.click(screen.getByRole('button', { name: /persist human review/i }))
    expect(await screen.findByText(/review was not persisted/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /queue test shopper message/i })).toBeDisabled()
  })

  it('gates the workstation behind the demo operator login', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: /station sign in/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/station id/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^pin$/i)).toBeInTheDocument()
    expect(screen.getByText(/no real credentials or identity verification/i)).toBeInTheDocument()
  })

  it('opens the refund dashboard once an operator is signed in', async () => {
    renderAt('/', {}, { operator: true })
    expect(screen.getByRole('heading', { name: /refund dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /workstation/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^home$/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByLabelText(/refund statistics/i)).toBeInTheDocument()
    expect(screen.getByRole('grid', { name: /august/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /station settings/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /log out/i }).length).toBeGreaterThan(0)
    expect(await screen.findByText(/total refunds/i)).toBeInTheDocument()
    const stats = screen.getByLabelText(/refund statistics/i)
    expect(stats).toHaveTextContent(/time saved with ai/i)
    expect(stats).toHaveTextContent(/wrongful refunds saved/i)
    expect(screen.getByRole('link', { name: /fraudulent attempts/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /redo verify/i })).toBeInTheDocument()
  })

  it('opens Redo Verify on the delivery rule and completes a customer choice', async () => {
    renderAt('/verify', {}, { operator: true })
    expect(screen.getByRole('heading', { name: /risk-to-route rules/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^delivery$/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('row', { name: /repeated delivery claims/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: /let.s verify your delivery/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /pickup near me/i }))
    await userEvent.click(screen.getByRole('button', { name: /^continue$/i }))
    expect(screen.getByRole('heading', { name: /you.re all set/i })).toBeInTheDocument()
    expect(screen.queryByText(/fraud/i)).not.toBeInTheDocument()
  })

  it('renders the Verify console surfaces from the mockups', async () => {
    renderAt('/verify/overview', {}, { operator: true })
    expect(screen.getByRole('heading', { name: /fraud protection overview/i })).toBeInTheDocument()
    expect(screen.getByText(/12,482/)).toBeInTheDocument()

    renderAt('/verify/cases/RV-10482', {}, { operator: true })
    expect(screen.getByRole('heading', { name: /case #rv-10482/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /preview experience/i })).toBeInTheDocument()

    renderAt('/verify/integrations', {}, { operator: true })
    expect(screen.getByRole('heading', { name: /^integrations$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /fedex authenticated/i })).toBeInTheDocument()

    renderAt('/verify/analytics', {}, { operator: true })
    expect(screen.getByRole('heading', { name: /fraud analytics/i })).toBeInTheDocument()
    expect(screen.getByText(/\$542,880/)).toBeInTheDocument()

    renderAt('/verify/settings', {}, { operator: true })
    expect(screen.getByRole('heading', { name: /fraud policy settings/i })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /never deny from score alone/i })).toBeInTheDocument()

    renderAt('/verify/customers', {}, { operator: true })
    expect(screen.getByRole('heading', { name: /customer trust profile/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /jordan hale/i })).toBeInTheDocument()
  })

  it('completes the customer verification experience without a fraud label', async () => {
    renderAt('/verify/experience', {}, { operator: true })
    expect(screen.getByRole('heading', { name: /one quick verification/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /verify my identity/i }))
    await userEvent.click(screen.getByRole('button', { name: /^continue$/i }))
    expect(screen.getByRole('heading', { name: /you.re all set/i })).toBeInTheDocument()
    expect(screen.queryByText(/fraud/i)).not.toBeInTheDocument()
  })

  it('opens Condition’s second path into Resolve', async () => {
    renderAt('/verify?tab=returns&rule=condition', {}, { operator: true })
    expect(screen.getByRole('heading', { name: /this item includes a return tag/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /need another way/i }))
    await userEvent.click(screen.getByRole('button', { name: /^continue$/i }))
    expect(screen.getByRole('heading', { name: /need another way/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /request review/i })).toBeInTheDocument()
  })

  it('opens the fraudulent attempts breakdown from the dashboard', async () => {
    renderAt('/', {}, { operator: true })
    await userEvent.click(await screen.findByRole('link', { name: /fraudulent attempts/i }))
    expect(await screen.findByRole('heading', { name: /fraudulent attempts/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /empty mailers/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /decoy returns/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /short-shipped returns/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/fraudulent attempt totals/i)).toHaveTextContent(/product held back/i)
    expect(screen.getAllByText(/\$464\.00/).length).toBeGreaterThan(0)
  })

  it('opens a case journey from the board with checkout through calls', async () => {
    renderAt('/board', {}, { operator: true })
    expect(screen.getByRole('heading', { name: /return board/i })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: /refunded/i })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: /fraudulent/i })).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: /noah chen/i }))
    expect(await screen.findByRole('dialog', { name: /noah chen/i })).toBeInTheDocument()
    expect(screen.getByText(/checkout sk-1099/i)).toBeInTheDocument()
    expect(screen.getByText(/pick · pack · label/i)).toBeInTheDocument()
    expect(screen.getByText(/inbound weight/i)).toBeInTheDocument()
    expect(screen.getByText(/matching contents/i)).toBeInTheDocument()
    expect(screen.getByText(/ai email queued/i)).toBeInTheDocument()
  })

  it('keeps the operations dashboard with a live work queue at /legacy', async () => {
    renderAt('/legacy')
    expect(screen.getByRole('heading', { name: /work the queue/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /needs attention/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /checkout challenge/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /impossible logistics/i })).toHaveAttribute('href', '/legacy/shopper?journey=return')
    expect(screen.getByRole('link', { name: /^dashboard$/i })).toHaveClass('topnav__link--active')

    await userEvent.type(screen.getByLabelText(/filter work queue/i), 'zzzz-no-match')
    expect(screen.getByText(/no matching work/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /clear filter/i }))
    expect(screen.getByRole('link', { name: /checkout challenge/i })).toBeInTheDocument()
  })

  it('keeps dashboard inactive on other stations and shows empty search and contest states', async () => {
    renderAt('/merchant')
    expect(screen.getByRole('link', { name: /^dashboard$/i })).not.toHaveClass('topnav__link--active')
    await userEvent.type(screen.getByLabelText(/search returns/i), 'zzzz-no-match')
    expect(screen.getByText(/no returns match/i)).toBeInTheDocument()
    expect(screen.getByText(/select a matching return/i)).toBeInTheDocument()
  })

  it('shows a shopper contest empty state until a human denial exists', async () => {
    renderAt('/shopper')
    await userEvent.click(screen.getByRole('tab', { name: /contest & appeal/i }))
    expect(screen.getByText(/no adverse decision to contest/i)).toBeInTheDocument()
  })

  it('keeps merchant findings and decision controls locked until the operator routes an observation', () => {
    renderAt('/merchant')
    expect(screen.getByRole('heading', { name: /operator review required/i })).toBeInTheDocument()
    expect(screen.queryByText(/corroborated finding/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /deny requires reason/i })).not.toBeInTheDocument()
  })

  it('keeps evidence-ready appeals in the work queue and does not call the walkthrough complete', () => {
    renderAt('/legacy', { checkout: 'cleared', reverseLogistics: 'cleared', physical: 'evidence-ready' })
    expect(screen.getByRole('link', { name: /contest window open/i })).toHaveAttribute('href', '/legacy/shopper?journey=appeal')
    expect(screen.getByText(/2 of 3/i)).toBeInTheDocument()
    expect(screen.queryByText(/every demo journey is resolved/i)).not.toBeInTheDocument()
  })

  it('records appeal explanation and selected filename in browser-local scenario state', async () => {
    renderAt('/shopper?journey=appeal', { physical: 'denied' })
    const file = new File(['fixture'], 'appeal-proof.png', { type: 'image/png' })
    await userEvent.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file)
    await userEvent.click(screen.getByRole('button', { name: /submit for a second human review/i }))
    expect(screen.getByRole('heading', { name: /appeal details are recorded/i })).toBeInTheDocument()
    expect(screen.getByText('appeal-proof.png')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /appeal-proof\.png/i })).toBeDisabled()
    expect(document.querySelector('input[type="file"]')).toBeDisabled()
    expect(screen.getByText(/does not upload or retain file contents/i)).toBeInTheDocument()
  })

  it('shows a lifecycle empty state when filters match nothing', async () => {
    renderAt('/lifecycle')
    await userEvent.click(screen.getByRole('button', { name: /^purchase$/i }))
    await userEvent.selectOptions(screen.getByLabelText(/coverage/i), 'Managed network')
    expect(screen.getByText(/no checkpoints in this view/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /reset filters/i }))
    expect(screen.getByTestId('checkpoint-VISIT_SESSION')).toBeInTheDocument()
  })

  it('opens the exact shopper journey from the URL and supports arrow-key tab navigation', async () => {
    renderAt('/shopper?journey=return')
    const returnTab = screen.getByRole('tab', { name: /return handoff/i })
    expect(returnTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(/return handoff/i)

    returnTab.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: /contest & appeal/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/no adverse decision to contest/i)).toBeInTheDocument()
  })

  it('keeps the operator neutral until a person selects and confirms an observation', async () => {
    renderAt('/operator')
    expect(screen.getByRole('radio', { name: /^empty$/i })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText(/no discrepancy classification is selected/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /select a native finding first/i })).toBeDisabled()

    await userEvent.click(screen.getByRole('radio', { name: /^inconclusive$/i }))
    expect(screen.getByRole('radio', { name: /^inconclusive$/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: /confirm the observation first/i })).toBeDisabled()
  })

  it('labels the single merchant case and reviewer persona honestly', () => {
    renderAt('/merchant', { physical: 'review-pending' })
    expect(screen.getByText(/active demo case/i)).toBeInTheDocument()
    expect(screen.getByText(/one coherent case/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /demo reviewer · unauthenticated persona/i })).toBeInTheDocument()
    expect(screen.queryByText(/jordan lee/i)).not.toBeInTheDocument()
  })

  it('provides skip navigation and route-specific document titles', () => {
    renderAt('/lifecycle')
    expect(screen.getByRole('link', { name: /skip to main content/i })).toHaveAttribute('href', '#main-content')
    expect(document.title).toBe('Decision lifecycle · Redo Return Integrity')
  })

  it('offers a Redo-style clickable demo gallery with working in-frame actions', async () => {
    renderAt('/tools')

    expect(await screen.findByRole('heading', { name: /try the return integrity layer/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /operations/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: /scan return label/i })).toHaveAttribute('aria-current', 'page')

    await userEvent.click(screen.getByRole('button', { name: /preview label lookup/i }))
    expect(screen.getByRole('heading', { name: /return preview found/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /continue from label lookup to inspect package/i }))
    expect(screen.getByRole('heading', { name: /what came back/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /quantity mismatch/i }))
    await userEvent.click(screen.getByRole('button', { name: /analyze contents/i }))
    expect(screen.getByText('QUANTITY_MISMATCH')).toBeInTheDocument()
    expect(screen.getByText('$58.00 refund')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: /shopper/i }))
    expect(screen.getByRole('heading', { name: /one quick check before we ship/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^open checkout journey$/i })).toHaveAttribute('href', '/legacy/shopper?journey=checkout')
  })

  it('restores a deep-linked merchant communication demo and supports keyboard tab movement', async () => {
    renderAt('/tools?category=merchant&demo=approve-message')

    const merchantTab = await screen.findByRole('tab', { name: /merchant/i })
    expect(merchantTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: /review the customer-message contract/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^open communication review$/i })).toHaveAttribute('href', '/legacy/intake')

    merchantTab.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: /intelligence/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: /inspect the decision lifecycle/i })).toBeInTheDocument()
  })
})
