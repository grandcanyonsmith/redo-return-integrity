import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { DemoProvider } from './lib/demo-context'

function renderAt(path: string) {
  sessionStorage.clear()
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

  it('requires a reason and certification before recording a human denial', async () => {
    renderAt('/merchant')
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
    expect(policySnapshot).toHaveTextContent('juniper-return-policy')
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

  it('opens on an operations dashboard with a live work queue', async () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: /work the queue/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /needs attention/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /checkout challenge/i })).toBeInTheDocument()
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

  it('shows a lifecycle empty state when filters match nothing', async () => {
    renderAt('/lifecycle')
    await userEvent.click(screen.getByRole('button', { name: /^purchase$/i }))
    await userEvent.selectOptions(screen.getByLabelText(/coverage/i), 'Managed network')
    expect(screen.getByText(/no checkpoints in this view/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /reset filters/i }))
    expect(screen.getByTestId('checkpoint-VISIT_SESSION')).toBeInTheDocument()
  })
})
