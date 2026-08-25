import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkpoints, newDemoState } from '../domain'
import { evaluateCheckpoint, joinWaitlist } from './api'

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
})

describe('live API adapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('creates an isolated API session and maps the nested checkpoint response', async () => {
    const sessionId = '6b88b173-a8f1-4578-a97d-d8381f251adb'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ session: { sessionId }, sessionToken: sessionId }, 201))
      .mockResolvedValueOnce(jsonResponse({
        decision: {
          checkpointId: 'ITEM_INSPECTION',
          openAIAssessment: {
            status: 'CONCERN', confidence: 0.91, summary: 'No expected item is visible.', recommendedDisposition: 'HUMAN_REVIEW',
            riskIndicators: [{ evidenceIds: ['ev-weight'] }], exculpatoryIndicators: [], imageFindings: [{ evidenceId: 'ev-frame-1' }], missingInformation: [],
          },
        },
        model: { simulated: false },
      }))
    vi.stubGlobal('fetch', fetchMock)

    const point = checkpoints.find((checkpoint) => checkpoint.id === 'ITEM_INSPECTION')!
    const result = await evaluateCheckpoint(point, newDemoState())

    expect(result).toMatchObject({ mode: 'live', recommendation: 'HUMAN_REVIEW', evidenceIds: ['ev-weight', 'ev-frame-1'] })
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/sessions', expect.objectContaining({ method: 'POST' }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/cases/case-physical-empty-return/checkpoints/ITEM_INSPECTION/evaluate', expect.objectContaining({
      headers: expect.objectContaining({ 'x-demo-session': sessionId }),
    }))
    expect(JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body))).toMatchObject({ physicalFinding: 'empty', simulate: false })
  })

  it('maps the backend waitlist state without claiming fallback non-submission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ state: 'CREATED', message: 'Recorded.' }, 201)))
    const result = await joinWaitlist({ email: 'research@example.com', role: 'Fraud & risk', companyUrl: '', consent: true })
    expect(result).toEqual({ accepted: true, mode: 'live', message: 'Recorded.' })
  })
})
