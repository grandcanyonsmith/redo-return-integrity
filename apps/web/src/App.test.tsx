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
    expect(screen.getByText('Native facts')).toBeInTheDocument()
    expect(screen.getByText('Shopper cure')).toBeInTheDocument()
    expect(screen.getByText('Accountable action')).toBeInTheDocument()
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
})
