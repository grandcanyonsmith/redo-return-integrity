import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkpoints, newDemoState } from '../domain'
import { analyzeReturnContents, draftReturnCommunication, evaluateCheckpoint, joinWaitlist, lookupReturnByLabel, queueTestCommunication, recordReturnReview, uploadIntakeEvidence } from './api'

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
})

const mcpResponse = (structuredContent: unknown) => jsonResponse({
  jsonrpc: '2.0',
  id: 'web-test',
  result: { content: [{ type: 'text', text: JSON.stringify(structuredContent) }], structuredContent, isError: false },
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
          nativeFacts: { expectedQuantity: 2, observedQuantity: 0 },
          deterministicSignals: [{ code: 'QUANTITY_MISMATCH', label: 'Quantity mismatch', status: 'OBSERVED', riskBearing: true, explanation: '0 of 2', evidenceIds: ['ev-weight'] }],
          openAIAssessment: {
            status: 'CONCERN', confidence: 0.91, summary: 'No expected item is visible.', recommendedDisposition: 'HUMAN_REVIEW',
            riskIndicators: [{ code: 'EMPTY_PACKAGE', explanation: 'No item visible.', evidenceIds: ['ev-weight'] }], exculpatoryIndicators: [], imageFindings: [{ evidenceId: 'ev-frame-1', contentsAssessment: 'EMPTY', serialReadable: false }], missingInformation: [],
          },
          merchantPolicyResult: { policyId: 'RET-HV-04', action: 'HUMAN_REVIEW', reasonCodes: ['WEIGHT_MISMATCH'], explanation: 'Hold for review.' },
          accountableFinalAction: { action: 'HUMAN_REVIEW', actor: 'SYSTEM_POLICY', rationale: 'Policy requires a person.', reversible: true },
          shopperCure: [{ label: 'Contest with more photos', owner: 'SHOPPER' }],
          nextState: 'AWAITING_MERCHANT',
        },
        model: { simulated: false, modelVersion: 'gpt-5.6-terra', latencyMs: 12000 },
      }))
    vi.stubGlobal('fetch', fetchMock)

    const point = checkpoints.find((checkpoint) => checkpoint.id === 'ITEM_INSPECTION')!
    const result = await evaluateCheckpoint(point, newDemoState())

    expect(result).toMatchObject({
      mode: 'live',
      recommendation: 'HUMAN_REVIEW',
      evidenceIds: ['ev-weight', 'ev-frame-1'],
      nativeFacts: { expectedQuantity: 2, observedQuantity: 0 },
      nextState: 'AWAITING_MERCHANT',
      policy: { policyId: 'RET-HV-04' },
    })
    expect(result.signals[0]?.code).toBe('QUANTITY_MISMATCH')
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

  it('normalizes the deployed intake wire contract without discarding successful tool results', async () => {
    const sessionId = '6b88b173-a8f1-4578-a97d-d8381f251adb'
    const modelAudit = { provider: 'SYNTHETIC_FIXTURE', requestedModel: 'fixture-1', providerModel: null, promptVersion: 'fixture-1', schemaName: 'return_package_inspection', requestId: null, latencyMs: 0, inputSha256: 'a'.repeat(64), outputSha256: 'b'.repeat(64), providerStorageRequested: false }
    const returnRecord = {
      returnRecordId: 'ret-jc-1042', merchantId: 'juniper-circuit-demo', merchantName: 'Juniper Circuit', labelId: 'LBL-8821',
      rmaId: 'RMA-8821', orderId: 'JC-1042', trackingNumber: '1Z-REDO-8821', carrier: 'UPS',
      customer: { customerId: 'demo-shopper-001', name: 'Avery Demo', email: 'avery.return@example.test', phone: '+1-555-010-8821' },
      product: { sku: 'JC-ARC-ONE-KIT', title: 'Juniper Arc One', quantity: 2, unitPriceCents: 92450, totalEligibleRefundCents: 184900, imageUrl: '/evidence/catalog-juniper-arc-one.png', serials: ['A', 'B'], attributes: {} },
      return: { reason: 'Changed mind', requestedRefundCents: 184900, currency: 'USD', policyId: 'juniper-return-policy', policyVersion: 'v3.4', policySnapshotSha256: 'c'.repeat(64), status: 'INSPECTION_PENDING' },
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ session: { sessionId }, sessionToken: sessionId }, 201))
      .mockResolvedValueOnce(mcpResponse({
        mode: 'DIRECT_IDENTIFIERS', extraction: { labelId: null, trackingNumber: null, rmaId: 'RMA-8821', orderId: null, carrier: null, confidence: 1, evidenceIds: ['ev-label'] }, returnRecord, matchedBy: 'RMA', warnings: [],
      }))
      .mockResolvedValueOnce(mcpResponse({
        mode: 'SYNTHETIC_FIXTURE', inspection: {
          inspectionId: 'inspection-live', returnRecordId: 'ret-jc-1042', createdAt: '2026-08-24T00:00:00.000Z', classification: 'EMPTY_BOX', confidence: 0.93, summary: 'No product observed.', observedItems: [{ description: 'No product', candidateSku: null, quantity: 0, condition: 'UNKNOWN', serials: [], evidenceIds: ['ev-package'] }], comparison: { skuMatch: false, quantityMatch: false, serialMatch: null, damageObserved: false, expectedQuantity: 2, observedQuantity: 0 }, missingEvidence: [], evidenceIds: ['ev-package'], nextAction: 'HOLD_FOR_REVIEW', refund: { recommendedType: 'TEMPORARY_HOLD', recommendedAmountCents: null, withholdAmountCents: 184900, rationale: 'Review.', requiresHumanApproval: true }, communication: { recommended: true, channel: 'EMAIL', templateIntent: 'REVIEW_HOLD' }, warehouseEvidenceImageUrl: '/evidence/return-empty-box.png', analysisMode: 'SYNTHETIC_FIXTURE', modelVersion: 'fixture-1', modelAudit,
        },
      }))
      .mockResolvedValueOnce(mcpResponse({ draft: { draftId: 'draft-live', inspectionId: 'inspection-live', returnRecordId: 'ret-jc-1042', createdAt: '2026-08-24T00:00:00.000Z', channel: 'EMAIL', recipient: 'avery.return@example.test', subject: 'Return update', body: 'Review update.', contentSha256: 'd'.repeat(64), modelAudit: { ...modelAudit, provider: 'SAFE_FALLBACK', schemaName: 'return_communication_copy' }, originalProductImageUrl: '/evidence/catalog-juniper-arc-one.png', warehouseEvidenceImageUrl: '/evidence/return-empty-box.png', attachments: [{ role: 'WAREHOUSE_EVIDENCE', sourceUrl: '/evidence/return-empty-box.png', altText: 'Evidence', provenance: 'Warehouse', evidenceId: 'ev-package' }], generationMode: 'SAFE_FALLBACK', requiresHumanApproval: true, deliveryStatus: 'DRAFT_NOT_SENT' } }))
      .mockResolvedValueOnce(mcpResponse({ review: { reviewId: 'review-live', inspectionId: 'inspection-live', draftId: 'draft-live', returnRecordId: 'ret-jc-1042', reviewerLabel: 'DEN-04 demo operator', reviewerIdentityAssurance: 'UNAUTHENTICATED_DISPLAY_LABEL', draftDecision: 'APPROVE_AS_WRITTEN', draftContentSha256: 'd'.repeat(64), acknowledgedRecommendation: true, acknowledgedPolicy: true, acknowledgedEvidence: true, reviewedAt: '2026-08-24T00:01:00.000Z', evidenceIds: ['ev-package'] } }))
      .mockResolvedValueOnce(mcpResponse({ status: 'QUEUED_TEST_OUTBOX', messageId: 'message-live', deliveryDisabled: true, message: { status: 'QUEUED_TEST_OUTBOX', deliveryDisabled: true } }))
    vi.stubGlobal('fetch', fetchMock)

    const lookup = await lookupReturnByLabel({ scanValue: 'RMA-8821' })
    const inspection = await analyzeReturnContents({ returnRecordId: lookup.returnRecord.returnRecordId, fixtureId: 'emptyReturn' })
    const draft = await draftReturnCommunication({ inspectionId: inspection.inspection.inspectionId, channel: 'EMAIL' })
    const review = await recordReturnReview({ inspectionId: inspection.inspection.inspectionId, draftId: draft.draft.draftId, reviewerLabel: 'DEN-04 demo operator', evidenceIds: inspection.inspection.evidenceIds })
    const queued = await queueTestCommunication({ draftId: draft.draft.draftId, reviewId: review.reviewId })

    expect(lookup).toMatchObject({ mode: 'live', executionMode: 'DIRECT_IDENTIFIERS', extraction: { trackingNumber: null, carrier: null }, matchedBy: 'RMA' })
    expect(inspection).toMatchObject({ mode: 'fallback', inspection: { classification: 'EMPTY_BOX' } })
    expect(draft).toMatchObject({ mode: 'unavailable', draft: { warehouseEvidenceImageUrl: '/evidence/return-empty-box.png' } })
    expect(queued).toMatchObject({ status: 'QUEUED_TEST_OUTBOX', messageId: 'message-live' })
    expect(queued.message).toMatch(/delivery-disabled test outbox/i)
    expect(fetchMock.mock.calls.slice(1).map((call) => JSON.parse(String((call[1] as RequestInit).body)).params.name)).toEqual([
      'lookup_return_by_label',
      'analyze_return_contents',
      'draft_return_communication',
      'record_return_review',
      'queue_test_communication',
    ])
    const reviewEnvelope = JSON.parse(String((fetchMock.mock.calls[4]?.[1] as RequestInit).body))
    expect(reviewEnvelope.params.arguments).toMatchObject({
      draftDecision: 'APPROVE_AS_WRITTEN',
      acknowledgedRecommendation: true,
      acknowledgedPolicy: true,
      acknowledgedEvidence: true,
    })
  })

  it('uploads a bounded signed POST and completes the exact S3 object version', async () => {
    const sessionId = '6b88b173-a8f1-4578-a97d-d8381f251adb'
    const sha256 = '01'.repeat(32)
    vi.stubGlobal('crypto', {
      subtle: { digest: vi.fn(async () => new Uint8Array(32).fill(1).buffer) },
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ session: { sessionId }, sessionToken: sessionId }, 201))
      .mockResolvedValueOnce(jsonResponse({
        status: 'UPLOAD_URL_ISSUED_NOT_EVIDENCE',
        uploadUrl: 'https://test-upload-bucket.s3.us-west-2.amazonaws.com/',
        objectKey: 'ephemeral/intake-return-label/random-upload.png',
        formFields: {
          key: 'ephemeral/intake-return-label/random-upload.png',
          'Content-Type': 'image/png',
          'x-amz-checksum-sha256': 'signed-checksum-field',
          policy: 'signed-policy',
        },
      }, 201))
      .mockResolvedValueOnce(new Response('', {
        status: 201,
        headers: { 'x-amz-version-id': 'immutable-version-7' },
      }))
      .mockResolvedValueOnce(jsonResponse({
        status: 'VERIFIED_INTAKE_EVIDENCE',
        evidence: {
          evidenceId: 'ev-upload-demo',
          purpose: 'RETURN_LABEL',
          versionId: 'immutable-version-7',
          sha256,
          sizeBytes: 8,
          expiresAt: '2026-08-25T00:00:00.000Z',
        },
        previewUrl: 'https://signed.example/object?versionId=immutable-version-7',
      }, 201))
    vi.stubGlobal('fetch', fetchMock)

    const result = await uploadIntakeEvidence('data:image/png;base64,iVBORw0KGgo=', 'RETURN_LABEL')
    expect(result).toMatchObject({
      evidenceId: 'ev-upload-demo',
      versionId: 'immutable-version-7',
      sha256,
      sizeBytes: 8,
    })

    const uploadInit = fetchMock.mock.calls[2]![1] as RequestInit
    expect(uploadInit.method).toBe('POST')
    expect(uploadInit.headers).toBeUndefined()
    expect(uploadInit.body).toBeInstanceOf(FormData)
    const form = uploadInit.body as FormData
    expect(form.get('key')).toBe('ephemeral/intake-return-label/random-upload.png')
    expect(form.get('x-amz-checksum-sha256')).toBe('signed-checksum-field')
    expect(form.get('file')).toBeInstanceOf(Blob)

    const completionBody = JSON.parse(String((fetchMock.mock.calls[3]![1] as RequestInit).body))
    expect(completionBody).toEqual({
      purpose: 'RETURN_LABEL',
      objectKey: 'ephemeral/intake-return-label/random-upload.png',
      versionId: 'immutable-version-7',
      sha256,
    })
  })
})
