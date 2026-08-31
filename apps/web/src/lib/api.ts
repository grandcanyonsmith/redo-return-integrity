import {
  RefundPortfolioSchema,
  buildRefundPortfolio,
  type RefundPortfolio,
} from '@return-integrity/domain/refund-portfolio'
import { z } from 'zod'
import type { Checkpoint, DemoState } from '../domain'

export type { RefundPortfolio }

const indicatorSchema = z.object({
  code: z.string().optional(),
  explanation: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
})

const imageFindingSchema = z.object({
  evidenceId: z.string(),
  packageState: z.string().optional(),
  contentsAssessment: z.string().optional(),
  labelReadable: z.boolean().optional(),
  serialReadable: z.boolean().optional(),
  notes: z.string().optional(),
})

const signalSchema = z.object({
  code: z.string(),
  label: z.string().optional(),
  status: z.string().optional(),
  severity: z.string().optional(),
  riskBearing: z.boolean().optional(),
  explanation: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
  value: z.number().optional(),
  threshold: z.number().optional(),
  unit: z.string().optional(),
})

export type AssessmentIndicator = z.infer<typeof indicatorSchema>
export type AssessmentImageFinding = z.infer<typeof imageFindingSchema>
export type AssessmentSignal = z.infer<typeof signalSchema>
export type AssessmentMode = 'live' | 'unavailable' | 'fallback'

export type Assessment = {
  caseId?: string
  checkpointId: string
  recommendation: string
  summary: string
  confidence: number | null
  evidenceIds: string[]
  missingEvidence: string[]
  mode: AssessmentMode
  status?: string
  latencyMs?: number
  modelVersion?: string
  promptVersion?: string
  policyVersion?: string
  nativeFacts: Record<string, unknown>
  signals: AssessmentSignal[]
  riskIndicators: AssessmentIndicator[]
  exculpatoryIndicators: AssessmentIndicator[]
  imageFindings: AssessmentImageFinding[]
  policy?: {
    policyId?: string
    policyVersion?: string
    action?: string
    target?: string
    reasonCodes: string[]
    explanation?: string
  }
  accountableAction?: {
    action: string
    target?: string
    actor?: string
    rationale?: string
    reversible?: boolean
  }
  shopperCure: Array<{ owner?: string; label: string; description?: string }>
  nextState?: string
  contractFlow: string[]
}

export type WaitlistInput = {
  email: string
  role: string
  companyUrl?: string
  consent: boolean
}

export type WaitlistResult = {
  accepted: boolean
  mode: 'live' | 'fallback'
  message: string
}

const API_SESSION_KEY = 'redo-return-integrity:api-session:v1'

const sessionResponseSchema = z.object({
  session: z.object({ sessionId: z.string().uuid() }),
  sessionToken: z.string().uuid(),
})

let pendingSession: Promise<string> | null = null

const ensureApiSession = async (): Promise<string> => {
  const saved = sessionStorage.getItem(API_SESSION_KEY)
  if (saved) return saved
  if (pendingSession) return pendingSession
  pendingSession = (async () => {
    const response = await fetch('/api/sessions', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    if (!response.ok) throw new Error(`Session API ${response.status}`)
    const parsed = sessionResponseSchema.parse(await response.json())
    sessionStorage.setItem(API_SESSION_KEY, parsed.sessionToken)
    return parsed.sessionToken
  })().finally(() => { pendingSession = null })
  return pendingSession
}

export const initializeApiSession = ensureApiSession

const apiRequest = async <T>(path: string, init: RequestInit, schema: z.ZodType<T>, requireDemoSession = false, timeoutMs = 8_000, attempt = 0): Promise<T> => {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const demoSession = requireDemoSession ? await ensureApiSession() : undefined
    const response = await fetch(path, {
      ...init,
      signal: controller.signal,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', ...(demoSession ? { 'x-demo-session': demoSession } : {}), ...(init.headers ?? {}) },
    })
    if (response.status === 401 && requireDemoSession && attempt === 0) {
      sessionStorage.removeItem(API_SESSION_KEY)
      return apiRequest(path, init, schema, requireDemoSession, timeoutMs, 1)
    }
    if (!response.ok) throw new Error(`API ${response.status}`)
    return schema.parse(await response.json())
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function resetApiSession(): Promise<void> {
  await apiRequest(
    '/api/session/reset',
    { method: 'POST', body: '{}' },
    z.object({ reset: z.literal(true) }),
    true,
    3_000,
  )
}

const evaluateResponseSchema = z.object({
  decision: z.object({
    checkpointId: z.string(),
    evaluatedAt: z.string().optional(),
    nativeFacts: z.record(z.string(), z.unknown()).optional(),
    deterministicSignals: z.array(signalSchema).default([]),
    openAIAssessment: z.object({
      status: z.enum(['PASS', 'CONCERN', 'INCONCLUSIVE', 'ERROR']),
      confidence: z.number().min(0).max(1),
      summary: z.string(),
      recommendedDisposition: z.string(),
      riskIndicators: z.array(indicatorSchema).default([]),
      exculpatoryIndicators: z.array(indicatorSchema).default([]),
      imageFindings: z.array(imageFindingSchema).default([]),
      missingInformation: z.array(z.string()).default([]),
    }),
    merchantPolicyResult: z.object({
      policyId: z.string().optional(),
      policyVersion: z.string().optional(),
      action: z.string().optional(),
      target: z.string().optional(),
      reasonCodes: z.array(z.string()).default([]),
      explanation: z.string().optional(),
    }).optional(),
    accountableFinalAction: z.object({
      action: z.string(),
      target: z.string().optional(),
      actor: z.string().optional(),
      rationale: z.string().optional(),
      reversible: z.boolean().optional(),
    }).optional(),
    shopperCure: z.array(z.object({
      owner: z.string().optional(),
      label: z.string(),
      description: z.string().optional(),
    })).default([]),
    nextState: z.string().optional(),
    modelVersion: z.string().optional(),
    promptVersion: z.string().optional(),
    policyVersion: z.string().optional(),
    simulated: z.boolean().optional(),
  }),
  model: z.object({
    simulated: z.boolean(),
    modelVersion: z.string().optional(),
    promptVersion: z.string().optional(),
    latencyMs: z.number().optional(),
  }),
  contract: z.object({
    flow: z.array(z.string()).optional(),
    humanFinalAdverseDecision: z.boolean().optional(),
  }).optional(),
})

const fallbackAssessment = (checkpoint: Checkpoint): Assessment => ({
  checkpointId: checkpoint.id,
  recommendation: checkpoint.assessment.detail.includes('abstain') ? 'ABSTAIN' : 'HUMAN_REVIEW',
  summary: checkpoint.assessment.detail,
  confidence: null,
  evidenceIds: [`fixture:${checkpoint.id.toLowerCase()}`],
  missingEvidence: checkpoint.evidenceTier === 'E4' || checkpoint.evidenceTier === 'E5' ? [] : ['Additional corroborating evidence'],
  mode: 'fallback',
  nativeFacts: {},
  signals: [],
  riskIndicators: [],
  exculpatoryIndicators: [],
  imageFindings: [],
  shopperCure: [],
  contractFlow: ['nativeFacts', 'deterministicSignals', 'openAIAssessment', 'merchantPolicyResult', 'accountableFinalAction', 'shopperCure', 'nextState'],
})

export async function evaluateCheckpoint(
  checkpoint: Checkpoint,
  state: DemoState,
): Promise<Assessment> {
  try {
    const caseId = checkpoint.number <= 4
      ? 'case-good-actor-checkout'
      : checkpoint.number <= 11
        ? 'case-impossible-logistics'
        : 'case-physical-empty-return'
    const result = await apiRequest(
      `/api/cases/${caseId}/checkpoints/${checkpoint.id}/evaluate`,
      {
        method: 'POST',
        body: JSON.stringify({ simulate: false, physicalFinding: state.physicalFinding }),
      },
      evaluateResponseSchema,
      true,
      45_000,
    )
    const model = result.decision.openAIAssessment
    const evidenceIds = [
      ...model.riskIndicators.flatMap((indicator) => indicator.evidenceIds),
      ...model.exculpatoryIndicators.flatMap((indicator) => indicator.evidenceIds),
      ...model.imageFindings.map((finding) => finding.evidenceId),
      ...result.decision.deterministicSignals.flatMap((signal) => signal.evidenceIds),
    ]
    return {
      caseId,
      checkpointId: result.decision.checkpointId,
      recommendation: model.recommendedDisposition,
      summary: model.summary,
      confidence: model.confidence,
      evidenceIds: [...new Set(evidenceIds)],
      missingEvidence: model.missingInformation,
      mode: result.model.simulated ? 'fallback' : model.status === 'ERROR' ? 'unavailable' : 'live',
      status: model.status,
      latencyMs: result.model.latencyMs,
      modelVersion: result.model.modelVersion ?? result.decision.modelVersion,
      promptVersion: result.model.promptVersion ?? result.decision.promptVersion,
      policyVersion: result.decision.policyVersion ?? result.decision.merchantPolicyResult?.policyVersion,
      nativeFacts: result.decision.nativeFacts ?? {},
      signals: result.decision.deterministicSignals,
      riskIndicators: model.riskIndicators,
      exculpatoryIndicators: model.exculpatoryIndicators,
      imageFindings: model.imageFindings,
      policy: result.decision.merchantPolicyResult,
      accountableAction: result.decision.accountableFinalAction,
      shopperCure: result.decision.shopperCure,
      nextState: result.decision.nextState,
      contractFlow: result.contract?.flow ?? ['nativeFacts', 'deterministicSignals', 'openAIAssessment', 'merchantPolicyResult', 'accountableFinalAction', 'shopperCure', 'nextState'],
    }
  } catch {
    return fallbackAssessment(checkpoint)
  }
}

const waitlistSchema = z.object({
  accepted: z.boolean().optional(),
  state: z.enum(['CREATED', 'EXISTING']).optional(),
  message: z.string().optional(),
})

export async function joinWaitlist(input: WaitlistInput): Promise<WaitlistResult> {
  try {
    const result = await apiRequest(
      '/api/waitlist',
      { method: 'POST', body: JSON.stringify({ ...input, companyUrl: input.companyUrl || undefined, noticeVersion: '2026-08-24' }) },
      waitlistSchema,
    )
    return {
      accepted: result.accepted ?? Boolean(result.state),
      mode: 'live',
      message: result.message ?? 'You’re on the research waitlist.',
    }
  } catch {
    return {
      accepted: false,
      mode: 'fallback',
      message: 'Preview mode: your details were not transmitted or saved. The live API is unavailable.',
    }
  }
}

export const intakeFixtureIds = [
  'matchReturn',
  'emptyReturn',
  'quantityMismatch',
  'wrongItem',
  'damagedProduct',
  'possibleImitation',
  'wardrobing',
] as const

export const inspectionClassifications = [
  'MATCH',
  'EMPTY_BOX',
  'DAMAGED_PRODUCT',
  'QUANTITY_MISMATCH',
  'WRONG_PRODUCT',
  'POSSIBLE_IMITATION',
  'WARDROBING',
  'INCONCLUSIVE',
] as const

export type IntakeFixtureId = (typeof intakeFixtureIds)[number]
export type InspectionClassification = (typeof inspectionClassifications)[number]
export type CommunicationChannel = 'EMAIL' | 'SMS'
type IntakeMode = 'live' | 'fallback' | 'unavailable'

export const draftableTemplateIntents = [
  'APPROVAL',
  'PARTIAL_REFUND_EXPLANATION',
  'EVIDENCE_REQUEST',
  'REVIEW_HOLD',
  'APPEAL_NOTICE',
  'RETURN_LABEL_OFFER',
  'SHIP_ITEM_BACK_REQUEST',
] as const
export type DraftableTemplateIntent = (typeof draftableTemplateIntents)[number]

export const intakeActionOptionIds = [
  'APPROVE_FULL_REFUND',
  'APPROVE_PARTIAL_REFUND',
  'TEXT_CUSTOMER_FOR_CLARITY',
  'EMAIL_EVIDENCE_REQUEST',
  'REQUEST_ITEM_SHIPPED_BACK',
  'OFFER_NEW_RETURN_LABEL',
  'HOLD_FOR_SUPERVISOR_REVIEW',
  'ROUTE_TO_AUTHENTICATION',
] as const
export type IntakeActionOptionId = (typeof intakeActionOptionIds)[number]

const intakeActionOptionSchema = z.object({
  id: z.enum(intakeActionOptionIds),
  label: z.string(),
  description: z.string(),
  channel: z.enum(['EMAIL', 'SMS']),
  templateIntent: z.enum(draftableTemplateIntents),
  recommended: z.boolean(),
})
export type IntakeActionOption = z.infer<typeof intakeActionOptionSchema>

export const intakeResolutionStatuses = [
  'REFUND_APPROVAL_PENDING',
  'PARTIAL_REFUND_PENDING',
  'ON_HOLD_REVIEW',
  'AWAITING_CUSTOMER',
  'AUTHENTICATION_REVIEW',
  'SET_ASIDE',
  'CALL_RESOLVED',
] as const
export type IntakeResolutionStatus = (typeof intakeResolutionStatuses)[number]

export const intakeDispositions = ['PASS', 'TAKE_MORE_PHOTOS', 'SET_ASIDE'] as const
export type IntakeDisposition = (typeof intakeDispositions)[number]

export const dispositionPreferences = ['AI_RECOMMEND', 'FORCE_PASS', 'FORCE_MORE_PHOTOS', 'FORCE_SET_ASIDE'] as const
export type DispositionPreference = (typeof dispositionPreferences)[number]

export const callResolutions = [
  'RESOLVED_REFUND_CONFIRMED',
  'CUSTOMER_WILL_SHIP_ITEM_BACK',
  'FOLLOW_UP_EMAIL_NEEDED',
  'NO_RESOLUTION_ESCALATE',
] as const
export type CallResolution = (typeof callResolutions)[number]

export const realtimeCallVoices = ['marin', 'cedar', 'alloy'] as const

const dispositionRecommendationWireSchema = z.object({
  disposition: z.enum(intakeDispositions),
  reason: z.string(),
  photoInstructions: z.array(z.string()).default([]),
  source: z.enum(['AI_RECOMMEND', 'OPERATOR_SETTING']),
})
export type DispositionRecommendation = z.infer<typeof dispositionRecommendationWireSchema>

const clientActionOptionCatalog: Record<IntakeActionOptionId, Omit<IntakeActionOption, 'recommended'>> = {
  APPROVE_FULL_REFUND: { id: 'APPROVE_FULL_REFUND', label: 'Approve full refund', description: 'Email the customer that the return matched and the full refund is queued for approval.', channel: 'EMAIL', templateIntent: 'APPROVAL' },
  APPROVE_PARTIAL_REFUND: { id: 'APPROVE_PARTIAL_REFUND', label: 'Approve partial refund', description: 'Email the customer the received-quantity refund math and queue the partial amount for approval.', channel: 'EMAIL', templateIntent: 'PARTIAL_REFUND_EXPLANATION' },
  TEXT_CUSTOMER_FOR_CLARITY: { id: 'TEXT_CUSTOMER_FOR_CLARITY', label: 'Text customer for clarity', description: 'Send a short SMS asking the customer to confirm what they shipped before any settlement.', channel: 'SMS', templateIntent: 'EVIDENCE_REQUEST' },
  EMAIL_EVIDENCE_REQUEST: { id: 'EMAIL_EVIDENCE_REQUEST', label: 'Request more evidence', description: 'Email the customer for packing photos, serial numbers, or proof of contents.', channel: 'EMAIL', templateIntent: 'EVIDENCE_REQUEST' },
  REQUEST_ITEM_SHIPPED_BACK: { id: 'REQUEST_ITEM_SHIPPED_BACK', label: 'Ask customer to ship the item back', description: 'Email the customer asking them to send the missing or incorrect item before settlement.', channel: 'EMAIL', templateIntent: 'SHIP_ITEM_BACK_REQUEST' },
  OFFER_NEW_RETURN_LABEL: { id: 'OFFER_NEW_RETURN_LABEL', label: 'Offer a new return label', description: 'Email a claim form the customer completes first; a fresh return label follows automatically.', channel: 'EMAIL', templateIntent: 'RETURN_LABEL_OFFER' },
  HOLD_FOR_SUPERVISOR_REVIEW: { id: 'HOLD_FOR_SUPERVISOR_REVIEW', label: 'Hold for supervisor review', description: 'Notify the customer of a short review hold and route the case to a supervisor.', channel: 'EMAIL', templateIntent: 'REVIEW_HOLD' },
  ROUTE_TO_AUTHENTICATION: { id: 'ROUTE_TO_AUTHENTICATION', label: 'Route to authentication', description: 'Notify the customer of a review hold while the item goes to qualified authentication.', channel: 'EMAIL', templateIntent: 'REVIEW_HOLD' },
}

const clientOptions = (recommendedId: IntakeActionOptionId, otherIds: IntakeActionOptionId[]): IntakeActionOption[] => [
  { ...clientActionOptionCatalog[recommendedId], recommended: true },
  ...otherIds.map((id) => ({ ...clientActionOptionCatalog[id], recommended: false })),
]

/** Mirror of the server's per-classification option list, used only when the
 * live inspection response predates or omits server-derived actionOptions. */
export const clientActionOptionsFor = (classification: InspectionClassification): IntakeActionOption[] => {
  switch (classification) {
    case 'MATCH':
      return clientOptions('APPROVE_FULL_REFUND', ['TEXT_CUSTOMER_FOR_CLARITY', 'HOLD_FOR_SUPERVISOR_REVIEW'])
    case 'QUANTITY_MISMATCH':
      return clientOptions('APPROVE_PARTIAL_REFUND', ['TEXT_CUSTOMER_FOR_CLARITY', 'REQUEST_ITEM_SHIPPED_BACK', 'OFFER_NEW_RETURN_LABEL', 'HOLD_FOR_SUPERVISOR_REVIEW'])
    case 'EMPTY_BOX':
      return clientOptions('HOLD_FOR_SUPERVISOR_REVIEW', ['EMAIL_EVIDENCE_REQUEST', 'TEXT_CUSTOMER_FOR_CLARITY'])
    case 'WRONG_PRODUCT':
      return clientOptions('HOLD_FOR_SUPERVISOR_REVIEW', ['REQUEST_ITEM_SHIPPED_BACK', 'OFFER_NEW_RETURN_LABEL', 'TEXT_CUSTOMER_FOR_CLARITY'])
    case 'POSSIBLE_IMITATION':
      return clientOptions('ROUTE_TO_AUTHENTICATION', ['HOLD_FOR_SUPERVISOR_REVIEW', 'EMAIL_EVIDENCE_REQUEST'])
    case 'WARDROBING':
      return clientOptions('HOLD_FOR_SUPERVISOR_REVIEW', ['EMAIL_EVIDENCE_REQUEST', 'TEXT_CUSTOMER_FOR_CLARITY', 'OFFER_NEW_RETURN_LABEL'])
    case 'DAMAGED_PRODUCT':
      return clientOptions('EMAIL_EVIDENCE_REQUEST', ['TEXT_CUSTOMER_FOR_CLARITY', 'OFFER_NEW_RETURN_LABEL', 'HOLD_FOR_SUPERVISOR_REVIEW'])
    case 'INCONCLUSIVE':
      return clientOptions('EMAIL_EVIDENCE_REQUEST', ['TEXT_CUSTOMER_FOR_CLARITY', 'HOLD_FOR_SUPERVISOR_REVIEW'])
  }
}

/** Mirror of the server's option → post-intake status mapping for offline display. */
export const resolutionStatusFor = (actionOptionId: IntakeActionOptionId): IntakeResolutionStatus => {
  switch (actionOptionId) {
    case 'APPROVE_FULL_REFUND':
      return 'REFUND_APPROVAL_PENDING'
    case 'APPROVE_PARTIAL_REFUND':
      return 'PARTIAL_REFUND_PENDING'
    case 'TEXT_CUSTOMER_FOR_CLARITY':
    case 'EMAIL_EVIDENCE_REQUEST':
    case 'REQUEST_ITEM_SHIPPED_BACK':
    case 'OFFER_NEW_RETURN_LABEL':
      return 'AWAITING_CUSTOMER'
    case 'HOLD_FOR_SUPERVISOR_REVIEW':
      return 'ON_HOLD_REVIEW'
    case 'ROUTE_TO_AUTHENTICATION':
      return 'AUTHENTICATION_REVIEW'
  }
}

const intakeWireModeSchema = z.enum([
  'live', 'fallback', 'unavailable',
  'OPENAI', 'SYNTHETIC_FIXTURE', 'DIRECT_IDENTIFIERS', 'SAFE_FALLBACK',
])

const normalizeIntakeMode = (mode: z.infer<typeof intakeWireModeSchema>): IntakeMode => {
  if (mode === 'live' || mode === 'OPENAI' || mode === 'DIRECT_IDENTIFIERS') return 'live'
  if (mode === 'unavailable' || mode === 'SAFE_FALLBACK') return 'unavailable'
  return 'fallback'
}

const customerProfileSchema = z.object({
  customerId: z.string().optional(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable().optional(),
}).passthrough()

const returnProductSchema = z.object({
  sku: z.string(),
  title: z.string(),
  quantity: z.number().int().nonnegative(),
  unitPriceCents: z.number().int().nonnegative(),
  totalEligibleRefundCents: z.number().int().nonnegative(),
  imageUrl: z.string(),
  serials: z.array(z.string()).default([]),
  attributes: z.record(z.string(), z.string()).optional(),
}).passthrough()

const returnRecordSchema = z.object({
  returnRecordId: z.string(),
  merchantId: z.string(),
  merchantName: z.string(),
  labelId: z.string(),
  rmaId: z.string(),
  orderId: z.string(),
  trackingNumber: z.string(),
  carrier: z.string(),
  customer: customerProfileSchema,
  product: returnProductSchema,
  return: z.object({
    reason: z.string(),
    requestedRefundCents: z.number().int().nonnegative(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    policyId: z.string(),
    policyVersion: z.string(),
    policySnapshotSha256: z.string().regex(/^[a-f0-9]{64}$/),
    status: z.string(),
  }).passthrough(),
}).passthrough()

const labelExtractionWireSchema = z.object({
  labelId: z.string().nullable(),
  trackingNumber: z.string().nullable(),
  rmaId: z.string().nullable(),
  orderId: z.string().nullable(),
  carrier: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  evidenceIds: z.array(z.string()).length(1),
}).passthrough()

const labelLookupWireSchema = z.object({
  mode: intakeWireModeSchema,
  extraction: labelExtractionWireSchema,
  returnRecord: returnRecordSchema.nullable(),
  matchedBy: z.enum(['LABEL', 'RMA', 'ORDER', 'TRACKING']).nullable(),
  warnings: z.array(z.string()).default([]),
}).passthrough()

const observedItemSchema = z.object({
  description: z.string(),
  candidateSku: z.string().nullable().optional(),
  quantity: z.number().int().nonnegative(),
  condition: z.string(),
  serials: z.array(z.string()).default([]),
}).passthrough()

const modelAuditWireSchema = z.object({
  provider: z.enum(['OPENAI', 'SYNTHETIC_FIXTURE', 'SAFE_FALLBACK']),
  requestedModel: z.string(),
  providerModel: z.string().nullable(),
  promptVersion: z.string(),
  schemaName: z.string(),
  requestId: z.string().nullable(),
  latencyMs: z.number().int().nonnegative(),
  inputSha256: z.string().regex(/^[a-f0-9]{64}$/),
  outputSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  providerStorageRequested: z.literal(false),
})

const inspectionWireSchema = z.object({
  inspectionId: z.string(),
  returnRecordId: z.string(),
  createdAt: z.string(),
  classification: z.enum(inspectionClassifications),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
  observedItems: z.array(observedItemSchema),
  comparison: z.object({
    skuMatch: z.boolean().nullable(),
    quantityMatch: z.boolean().nullable(),
    serialMatch: z.boolean().nullable(),
    damageObserved: z.boolean().nullable(),
    expectedQuantity: z.number().int().nonnegative(),
    observedQuantity: z.number().int().nonnegative().nullable(),
  }),
  nextAction: z.enum(['APPROVE_FULL', 'APPROVE_PARTIAL', 'HOLD_FOR_REVIEW', 'REQUEST_MORE_EVIDENCE', 'ROUTE_AUTHENTICATION']),
  refund: z.object({
    recommendedType: z.enum(['FULL', 'PARTIAL', 'TEMPORARY_HOLD', 'NO_RECOMMENDATION']),
    recommendedAmountCents: z.number().int().nonnegative().nullable(),
    withholdAmountCents: z.number().int().nonnegative().nullable(),
    rationale: z.string(),
    requiresHumanApproval: z.boolean(),
  }).passthrough(),
  communication: z.object({
    recommended: z.boolean(),
    channel: z.enum(['EMAIL', 'SMS', 'NONE']),
    templateIntent: z.enum([...draftableTemplateIntents, 'NONE']),
  }).passthrough(),
  actionOptions: z.array(intakeActionOptionSchema).optional(),
  dispositionRecommendation: dispositionRecommendationWireSchema.optional(),
  missingEvidence: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  warehouseEvidenceImageUrl: z.string().nullable().optional(),
  analysisMode: z.enum(['OPENAI', 'SYNTHETIC_FIXTURE', 'SAFE_FALLBACK']),
  modelVersion: z.string(),
  modelAudit: modelAuditWireSchema,
})

const inspectionWireResultSchema = z.object({
  mode: intakeWireModeSchema,
  inspection: inspectionWireSchema,
})

const communicationDraftWireSchema = z.object({
  draftId: z.string(),
  templateIntent: z.enum(draftableTemplateIntents).optional(),
  actionOptionId: z.enum(intakeActionOptionIds).optional(),
  channel: z.enum(['EMAIL', 'SMS']),
  recipient: z.string(),
  subject: z.string().nullable().optional(),
  body: z.string(),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  modelAudit: modelAuditWireSchema,
  originalProductImageUrl: z.string(),
  warehouseEvidenceImageUrl: z.string().nullable(),
  attachments: z.array(z.object({
    label: z.string().optional(),
    url: z.string().optional(),
    role: z.enum(['ORIGINAL_PRODUCT_REFERENCE', 'WAREHOUSE_EVIDENCE']).optional(),
    sourceUrl: z.string().optional(),
    altText: z.string().optional(),
    provenance: z.string(),
    evidenceId: z.string().nullable().optional(),
  }).passthrough()).default([]),
  generationMode: z.enum(['OPENAI', 'SAFE_FALLBACK']).optional(),
})

const draftWireResultSchema = z.object({
  mode: intakeWireModeSchema.optional(),
  draft: communicationDraftWireSchema,
}).passthrough()

const intakeReviewSchema = z.object({
  reviewId: z.string(),
  inspectionId: z.string(),
  draftId: z.string(),
  returnRecordId: z.string(),
  reviewerLabel: z.string(),
  reviewerIdentityAssurance: z.literal('UNAUTHENTICATED_DISPLAY_LABEL'),
  draftDecision: z.literal('APPROVE_AS_WRITTEN'),
  draftContentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  acknowledgedRecommendation: z.literal(true),
  acknowledgedPolicy: z.literal(true),
  acknowledgedEvidence: z.literal(true),
  reviewedAt: z.string(),
  evidenceIds: z.array(z.string()),
})

const intakeReviewWireResultSchema = z.object({ review: intakeReviewSchema })

const intakeActivityWireSchema = z.object({
  activityId: z.string(),
  kind: z.enum(['MESSAGE_QUEUED', 'DISPOSITION_RECORDED', 'CALL_COMPLETED']).default('MESSAGE_QUEUED'),
  returnRecordId: z.string(),
  rmaId: z.string(),
  orderId: z.string(),
  customerName: z.string(),
  productTitle: z.string(),
  classification: z.enum(inspectionClassifications),
  resolutionStatus: z.enum(intakeResolutionStatuses),
  channel: z.enum(['EMAIL', 'SMS', 'VOICE', 'NONE']),
  templateIntent: z.enum(draftableTemplateIntents).optional(),
  disposition: z.enum(intakeDispositions).optional(),
  note: z.string().optional(),
  handledBy: z.string().optional(),
  inspectionId: z.string(),
  messageId: z.string().optional(),
  recordedAt: z.string(),
}).passthrough()
export type IntakeActivityRecord = z.infer<typeof intakeActivityWireSchema>

const queueWireResultSchema = z.object({
  status: z.enum(['QUEUED_TEST_OUTBOX', 'NOT_QUEUED_API_UNAVAILABLE']),
  messageId: z.string().optional(),
  message: z.union([z.string(), z.object({
    status: z.literal('QUEUED_TEST_OUTBOX'),
    deliveryDisabled: z.literal(true),
  }).passthrough()]),
  activity: intakeActivityWireSchema.optional(),
})

const activityListWireSchema = z.object({ activity: z.array(intakeActivityWireSchema) })

export type ReturnRecord = z.infer<typeof returnRecordSchema>
export type LabelLookupResult = {
  mode: IntakeMode
  executionMode: z.infer<typeof intakeWireModeSchema>
  extraction: {
    labelId: string | null
    trackingNumber: string | null
    rmaId: string | null
    orderId: string | null
    carrier: string | null
    confidence: number
    evidenceIds: string[]
  }
  returnRecord: ReturnRecord
  matchedBy: 'LABEL' | 'RMA' | 'ORDER' | 'TRACKING'
  warnings: string[]
}
type InspectionWire = z.infer<typeof inspectionWireSchema>
export type PackageInspection = Omit<InspectionWire, 'comparison' | 'warehouseEvidenceImageUrl' | 'actionOptions' | 'dispositionRecommendation'> & {
  comparison: Omit<InspectionWire['comparison'], 'observedQuantity'> & { observedQuantity: number }
  warehouseEvidenceImageUrl?: string
  actionOptions: IntakeActionOption[]
  dispositionRecommendation: DispositionRecommendation
}

/** Mirror of the server's triage derivation for responses that predate it
 * (and the offline fixture path). Uses default station settings. */
export const clientDispositionFor = (
  classification: InspectionClassification,
  confidence: number,
  missingEvidence: string[] = [],
): DispositionRecommendation => {
  const instructions = missingEvidence.filter((entry) => /photo|image|capture|angle|view|shot|visible/i.test(entry))
  switch (classification) {
    case 'MATCH':
    case 'QUANTITY_MISMATCH':
      return confidence >= 0.8
        ? { disposition: 'PASS', reason: `Photos corroborate ${classification.replaceAll('_', ' ').toLowerCase()} at ${Math.round(confidence * 100)}% confidence. Proceed to the action list.`, photoInstructions: [], source: 'AI_RECOMMEND' }
        : { disposition: 'TAKE_MORE_PHOTOS', reason: `Confidence ${Math.round(confidence * 100)}% is below the station pass threshold (80%).`, photoInstructions: [...instructions, 'One overhead shot with every unit visible', 'Close-up of each serial label'], source: 'AI_RECOMMEND' }
    case 'DAMAGED_PRODUCT':
      return { disposition: 'TAKE_MORE_PHOTOS', reason: 'Damage needs documented close-ups before a condition grade.', photoInstructions: [...instructions, 'Close-up of the damaged area', 'Second angle showing the full unit'], source: 'AI_RECOMMEND' }
    case 'INCONCLUSIVE':
      return { disposition: 'TAKE_MORE_PHOTOS', reason: 'The capture does not show the contents clearly enough to classify.', photoInstructions: [...instructions, 'Move every item out of the box and lay them flat', 'One overhead shot with all contents visible'], source: 'AI_RECOMMEND' }
    case 'EMPTY_BOX':
      return { disposition: 'SET_ASIDE', reason: 'No merchandise is visible. Set the box aside for weight verification and supervisor processing.', photoInstructions: [], source: 'AI_RECOMMEND' }
    case 'WRONG_PRODUCT':
      return { disposition: 'SET_ASIDE', reason: 'The visible item does not match the authorized SKU. Set the box aside for further processing.', photoInstructions: [], source: 'AI_RECOMMEND' }
    case 'POSSIBLE_IMITATION':
      return { disposition: 'SET_ASIDE', reason: 'Authenticity cannot be established from photos. Set the item aside for qualified authentication.', photoInstructions: [], source: 'AI_RECOMMEND' }
    case 'WARDROBING':
      return { disposition: 'SET_ASIDE', reason: 'The garment shows wear against a policy that requires new, unworn condition with tags and liners attached. Set it aside for a human condition grade.', photoInstructions: [], source: 'AI_RECOMMEND' }
  }
}
export type InspectionResult = { mode: IntakeMode; executionMode: z.infer<typeof intakeWireModeSchema>; inspection: PackageInspection }
export type CommunicationDraft = Omit<z.infer<typeof communicationDraftWireSchema>, 'warehouseEvidenceImageUrl' | 'attachments'> & {
  warehouseEvidenceImageUrl: string | null
  attachments: Array<{
    label: string
    url: string
    role?: 'ORIGINAL_PRODUCT_REFERENCE' | 'WAREHOUSE_EVIDENCE'
    altText?: string
    provenance: string
    evidenceId?: string | null
  }>
}
export type DraftResult = { mode: IntakeMode; executionMode: z.infer<typeof intakeWireModeSchema>; draft: CommunicationDraft }
export type IntakeReview = z.infer<typeof intakeReviewSchema>
export type QueueResult = {
  status: 'QUEUED_TEST_OUTBOX' | 'NOT_QUEUED_API_UNAVAILABLE'
  messageId?: string
  message: string
  activity?: IntakeActivityRecord
}

const mcpToolEnvelopeSchema = z.object({
  jsonrpc: z.literal('2.0'),
  result: z.object({
    structuredContent: z.unknown().optional(),
    isError: z.boolean().optional(),
  }).passthrough().optional(),
  error: z.object({ code: z.number(), message: z.string() }).passthrough().optional(),
}).passthrough()

let mcpRequestSequence = 0
const MCP_PROTOCOL_VERSION = '2026-07-28'
const MCP_CLIENT_META = {
  'io.modelcontextprotocol/protocolVersion': MCP_PROTOCOL_VERSION,
  'io.modelcontextprotocol/clientInfo': { name: 'redo-return-integrity-web', version: '0.3.0' },
  'io.modelcontextprotocol/clientCapabilities': {},
} as const

const callMcpTool = async <T>(
  name: string,
  argumentsValue: unknown,
  schema: z.ZodType<T>,
  timeoutMs: number,
): Promise<T> => {
  mcpRequestSequence += 1
  const envelope = await apiRequest(
    '/api/mcp',
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'mcp-protocol-version': MCP_PROTOCOL_VERSION,
        'mcp-method': 'tools/call',
        'mcp-name': name,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `web-${mcpRequestSequence}`,
        method: 'tools/call',
        params: { name, arguments: argumentsValue, _meta: MCP_CLIENT_META },
      }),
    },
    mcpToolEnvelopeSchema,
    true,
    timeoutMs,
  )
  if (envelope.error) throw new Error(`MCP_${envelope.error.code}`)
  if (!envelope.result) throw new Error('MCP_RESULT_MISSING')
  if (envelope.result.isError) {
    const parsed = z.object({ error: z.object({ code: z.string() }) }).safeParse(envelope.result.structuredContent)
    throw new Error(parsed.success ? `MCP_TOOL_${parsed.data.error.code}` : 'MCP_TOOL_FAILED')
  }
  if (envelope.result.structuredContent === undefined) throw new Error('MCP_STRUCTURED_RESULT_MISSING')
  return schema.parse(envelope.result.structuredContent)
}

const uploadPresignWireSchema = z.object({
  status: z.string(),
  uploadUrl: z.string().optional(),
  objectKey: z.string().optional(),
  formFields: z.record(z.string(), z.string()).optional(),
  retentionHours: z.number().optional(),
  message: z.string().optional(),
})

const completedEvidenceWireSchema = z.object({
  status: z.literal('VERIFIED_INTAKE_EVIDENCE'),
  evidence: z.object({
    evidenceId: z.string(),
    purpose: z.enum(['RETURN_LABEL', 'PACKAGE_CONTENTS']),
    versionId: z.string(),
    sha256: z.string(),
    sizeBytes: z.number().int().positive(),
    expiresAt: z.string(),
  }).passthrough(),
  previewUrl: z.string(),
})

export type IntakeEvidencePurpose = 'RETURN_LABEL' | 'PACKAGE_CONTENTS'
export type VerifiedIntakeUpload = {
  evidenceId: string
  previewUrl: string
  versionId: string
  sha256: string
  sizeBytes: number
  expiresAt: string
}

const blobFromDataUrl = (dataUrl: string): Blob => {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match?.[1] || !match[2]) throw new Error('The prepared image format is not supported.')
  const binary = window.atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: match[1] })
}

const sha256Hex = async (blob: Blob): Promise<string> => {
  if (!window.crypto.subtle) throw new Error('This browser cannot verify an upload checksum.')
  const bytes = typeof blob.arrayBuffer === 'function'
    ? await blob.arrayBuffer()
    : await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('The browser could not checksum the prepared image.'))
        reader.onload = () => reader.result instanceof ArrayBuffer
          ? resolve(reader.result)
          : reject(new Error('The browser could not checksum the prepared image.'))
        reader.readAsArrayBuffer(blob)
      })
  const digest = await window.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function uploadIntakeEvidence(dataUrl: string, purpose: IntakeEvidencePurpose): Promise<VerifiedIntakeUpload> {
  const blob = blobFromDataUrl(dataUrl)
  if (blob.size > 5 * 1024 * 1024) throw new Error('Prepared image must be 5 MB or smaller.')
  const sha256 = await sha256Hex(blob)
  const presign = await apiRequest(
    '/api/uploads/presign',
    { method: 'POST', body: JSON.stringify({ purpose, mimeType: blob.type, sizeBytes: blob.size, sha256 }) },
    uploadPresignWireSchema,
    true,
    12_000,
  )
  if (presign.status !== 'UPLOAD_URL_ISSUED_NOT_EVIDENCE' || !presign.uploadUrl || !presign.objectKey || !presign.formFields) {
    throw new Error(presign.message ?? 'Ephemeral AWS evidence upload is unavailable.')
  }
  const form = new FormData()
  for (const [name, value] of Object.entries(presign.formFields)) form.append(name, value)
  form.append('file', blob)
  const uploaded = await fetch(presign.uploadUrl, {
    method: 'POST',
    body: form,
  })
  if (!uploaded.ok) throw new Error(`AWS evidence upload failed (${uploaded.status}).`)
  const versionId = uploaded.headers.get('x-amz-version-id')
  if (!versionId || versionId === 'null') throw new Error('AWS did not return an immutable object version; the upload was not accepted as evidence.')
  const completed = await apiRequest(
    '/api/uploads/complete',
    { method: 'POST', body: JSON.stringify({ purpose, objectKey: presign.objectKey, versionId, sha256 }) },
    completedEvidenceWireSchema,
    true,
    20_000,
  )
  return {
    evidenceId: completed.evidence.evidenceId,
    previewUrl: completed.previewUrl,
    versionId: completed.evidence.versionId,
    sha256: completed.evidence.sha256,
    sizeBytes: completed.evidence.sizeBytes,
    expiresAt: completed.evidence.expiresAt,
  }
}

const fallbackReturnRecord: ReturnRecord = {
  returnRecordId: 'ret-sk-1042',
  merchantId: 'skims',
  merchantName: 'SKIMS',
  labelId: 'LBL-8821',
  rmaId: 'RMA-8821',
  orderId: 'SK-1042',
  trackingNumber: '1Z-REDO-8821',
  carrier: 'UPS',
  customer: {
    customerId: 'demo-shopper-001',
    name: 'Avery Demo',
    email: 'avery.return@example.test',
    phone: '+1-555-010-8821',
  },
  product: {
    sku: 'SK-FE-CAMI-BODYSUIT',
    title: 'Fits Everybody Cami Bodysuit',
    quantity: 2,
    unitPriceCents: 5_800,
    totalEligibleRefundCents: 11_600,
    imageUrl: '/evidence/catalog-fits-everybody-bodysuit.png',
    serials: [],
    attributes: { variant: 'Onyx · sizes M and L', expectedPackedWeight: '380 g' },
  },
  return: {
    reason: 'Ordered two sizes',
    requestedRefundCents: 11_600,
    currency: 'USD',
    policyId: 'skims-returns',
    policyVersion: 'seeded-policy-1',
    policySnapshotSha256: '92fe5169bc20d5bd60814c9cddd6384586c85ba7b8f119e6cc787c8d449e4da6',
    status: 'INSPECTION_PENDING',
  },
}

const fallbackLabelLookup = (): LabelLookupResult => ({
  mode: 'fallback',
  executionMode: 'SYNTHETIC_FIXTURE',
  extraction: {
    labelId: fallbackReturnRecord.labelId,
    trackingNumber: fallbackReturnRecord.trackingNumber,
    rmaId: fallbackReturnRecord.rmaId,
    orderId: fallbackReturnRecord.orderId,
    carrier: fallbackReturnRecord.carrier,
    confidence: 0.99,
    evidenceIds: ['fixture:labelRma8821'],
  },
  returnRecord: fallbackReturnRecord,
  matchedBy: 'LABEL',
  warnings: ['The live API was unavailable; this is a client-side synthetic fixture.'],
})

type FallbackInspectionConfig = {
  classification: InspectionClassification
  confidence: number
  summary: string
  description: string
  candidateSku: string | null
  quantity: number
  condition: string
  nextAction: PackageInspection['nextAction']
  recommendedType: PackageInspection['refund']['recommendedType']
  recommendedAmountCents: number | null
  withholdAmountCents: number | null
  rationale: string
  templateIntent: PackageInspection['communication']['templateIntent']
  imageUrl: string
  missingEvidence?: string[]
}

const fallbackInspectionConfigs: Record<IntakeFixtureId, FallbackInspectionConfig> = {
  matchReturn: {
    classification: 'MATCH', confidence: 0.97,
    summary: 'Both authorized pieces are visible in sealed polybags with hang tags and hygiene liners attached. Style, color, sizes, and quantity match the order record.',
    description: 'Two Fits Everybody Cami Bodysuits (Onyx · M and L)', candidateSku: 'SK-FE-CAMI-BODYSUIT', quantity: 2, condition: 'Received · new and unworn',
    nextAction: 'APPROVE_FULL', recommendedType: 'FULL', recommendedAmountCents: 11_600, withholdAmountCents: 0,
    rationale: 'Expected style, quantity, and returnable condition are observed. Merchant review is still required before funds move.',
    templateIntent: 'APPROVAL', imageUrl: '/evidence/return-matching-contents.png',
  },
  emptyReturn: {
    classification: 'EMPTY_BOX', confidence: 0.93,
    summary: 'No garment is visible in the opened mailer. The complete capture sequence shows the packing slip only; expected quantity is two.',
    description: 'No garment observed', candidateSku: null, quantity: 0, condition: 'Empty mailer',
    nextAction: 'REQUEST_MORE_EVIDENCE', recommendedType: 'TEMPORARY_HOLD', recommendedAmountCents: null, withholdAmountCents: 11_600,
    rationale: 'Temporarily hold the requested refund while a reviewer verifies the capture protocol and gives the shopper a cure path.',
    templateIntent: 'EVIDENCE_REQUEST', imageUrl: '/evidence/return-empty-box.png',
  },
  quantityMismatch: {
    classification: 'QUANTITY_MISMATCH', confidence: 0.91,
    summary: 'One polybagged bodysuit is visible although the authorized return and order record expect two pieces.',
    description: 'One Fits Everybody Cami Bodysuit (Onyx · M)', candidateSku: 'SK-FE-CAMI-BODYSUIT', quantity: 1, condition: 'Received · one piece absent',
    nextAction: 'APPROVE_PARTIAL', recommendedType: 'PARTIAL', recommendedAmountCents: 5_800, withholdAmountCents: 5_800,
    rationale: 'The policy-calculated ceiling is one eligible piece. A human must confirm line-item value and any shopper evidence.',
    templateIntent: 'PARTIAL_REFUND_EXPLANATION', imageUrl: '/evidence/return-quantity-mismatch.png',
    missingEvidence: ['Second piece or pre-handoff packing evidence'],
  },
  wrongItem: {
    classification: 'WRONG_PRODUCT', confidence: 0.89,
    summary: 'The visible garment does not match the authorized style in fabric, construction, or catalog attributes, and carries no brand tags or hygiene liner.',
    description: 'Unbranded grey cotton t-shirt', candidateSku: 'UNMATCHED', quantity: 1, condition: 'Received · wrong garment',
    nextAction: 'HOLD_FOR_REVIEW', recommendedType: 'TEMPORARY_HOLD', recommendedAmountCents: null, withholdAmountCents: 11_600,
    rationale: 'Keep the refund reversible while a reviewer confirms the style mismatch and invites a shopper explanation.',
    templateIntent: 'REVIEW_HOLD', imageUrl: '/evidence/return-wrong-item.png',
  },
  damagedProduct: {
    classification: 'DAMAGED_PRODUCT', confidence: 0.86,
    summary: 'The expected style and quantity are visible. One piece shows a snagged seam and a run in the knit that require human condition grading.',
    description: 'Two Fits Everybody Cami Bodysuits (Onyx · M and L)', candidateSku: 'SK-FE-CAMI-BODYSUIT', quantity: 2, condition: 'One piece has a snag and a run',
    nextAction: 'HOLD_FOR_REVIEW', recommendedType: 'NO_RECOMMENDATION', recommendedAmountCents: null, withholdAmountCents: null,
    rationale: 'A photo cannot establish policy eligibility, causation, or salvage value. A human must grade the item and apply the merchant policy before choosing refund cents.',
    templateIntent: 'EVIDENCE_REQUEST', imageUrl: '/evidence/return-damaged-product.png',
    missingEvidence: ['Second-angle damage photo', 'Operator condition grade'],
  },
  possibleImitation: {
    classification: 'POSSIBLE_IMITATION', confidence: 0.72,
    summary: 'The garment resembles the catalog style, but neck-tag typography, care-label layout, and seam finish differ. The image alone cannot establish authenticity.',
    description: 'Bodysuit with inconsistent labels and seam finish', candidateSku: 'SK-FE-CAMI-BODYSUIT?', quantity: 2, condition: 'Authentication unresolved',
    nextAction: 'ROUTE_AUTHENTICATION', recommendedType: 'TEMPORARY_HOLD', recommendedAmountCents: null, withholdAmountCents: 11_600,
    rationale: 'Do not infer counterfeit status from an image. Route to independent authentication and preserve a shopper contest path.',
    templateIntent: 'REVIEW_HOLD', imageUrl: '/evidence/return-imitation.png',
    missingEvidence: ['Independent authentication', 'Macro care-label image', 'Second garment angle'],
  },
  wardrobing: {
    classification: 'WARDROBING', confidence: 0.9,
    summary: 'Both authorized pieces are present, but one shows makeup transfer at the neckline, a missing hygiene liner, and a hang tag reattached with a safety pin.',
    description: 'Two Fits Everybody Cami Bodysuits (Onyx · M and L)', candidateSku: 'SK-FE-CAMI-BODYSUIT', quantity: 2, condition: 'Worn · outside returnable condition',
    nextAction: 'HOLD_FOR_REVIEW', recommendedType: 'NO_RECOMMENDATION', recommendedAmountCents: null, withholdAmountCents: null,
    rationale: 'Wear signals are a condition question under the merchant policy, not proof of intent. A human must grade the garment before any refund decision.',
    templateIntent: 'REVIEW_HOLD', imageUrl: '/evidence/return-wardrobing.png',
    missingEvidence: ['Human condition grade', 'Merchant policy eligibility review'],
  },
}

const fallbackModelAudit = (provider: 'SYNTHETIC_FIXTURE' | 'SAFE_FALLBACK') => ({
  provider,
  requestedModel: provider === 'SYNTHETIC_FIXTURE' ? 'synthetic-fixture-inspector-1.0' : 'gpt-5.6-terra',
  providerModel: null,
  promptVersion: provider === 'SYNTHETIC_FIXTURE' ? 'synthetic-package-fixture-1.0' : 'return-communication-draft-1.0',
  schemaName: provider === 'SYNTHETIC_FIXTURE' ? 'return_package_inspection' : 'return_communication_copy',
  requestId: null,
  latencyMs: 0,
  inputSha256: '0'.repeat(64),
  outputSha256: null,
  providerStorageRequested: false as const,
})

const fallbackInspection = (fixtureId: IntakeFixtureId): InspectionResult => {
  const config = fallbackInspectionConfigs[fixtureId]
  const quantityMatch = config.quantity === fallbackReturnRecord.product.quantity
  const skuMatch = config.candidateSku === fallbackReturnRecord.product.sku
  return {
    mode: 'fallback',
    executionMode: 'SYNTHETIC_FIXTURE',
    inspection: {
      inspectionId: `inspection-${fixtureId.toLowerCase()}-fixture`,
      returnRecordId: fallbackReturnRecord.returnRecordId,
      createdAt: '2026-08-24T14:30:00.000Z',
      classification: config.classification,
      confidence: config.confidence,
      summary: config.summary,
      observedItems: [{
        description: config.description,
        candidateSku: config.candidateSku,
        quantity: config.quantity,
        condition: config.condition,
        serials: fixtureId === 'matchReturn' ? fallbackReturnRecord.product.serials : fixtureId === 'quantityMismatch' ? [fallbackReturnRecord.product.serials[0]!] : [],
      }],
      comparison: {
        skuMatch,
        quantityMatch,
        serialMatch: fixtureId === 'matchReturn' ? true : fixtureId === 'quantityMismatch' ? false : null,
        damageObserved: fixtureId === 'damagedProduct',
        expectedQuantity: fallbackReturnRecord.product.quantity,
        observedQuantity: config.quantity,
      },
      nextAction: config.nextAction,
      refund: {
        recommendedType: config.recommendedType,
        recommendedAmountCents: config.recommendedAmountCents,
        withholdAmountCents: config.withholdAmountCents,
        rationale: config.rationale,
        requiresHumanApproval: true,
      },
      communication: {
        recommended: true,
        channel: 'EMAIL',
        templateIntent: config.templateIntent,
      },
      actionOptions: clientActionOptionsFor(config.classification),
      dispositionRecommendation: clientDispositionFor(config.classification, config.confidence, config.missingEvidence ?? []),
      missingEvidence: config.missingEvidence ?? [],
      evidenceIds: [`fixture:${fixtureId}`, 'fixture:labelRma8821', 'fixture:catalog-fits-everybody-bodysuit'],
      warehouseEvidenceImageUrl: config.imageUrl,
      analysisMode: 'SYNTHETIC_FIXTURE',
      modelVersion: 'synthetic-fixture-inspector-1.0',
      modelAudit: fallbackModelAudit('SYNTHETIC_FIXTURE'),
    },
  }
}

export async function lookupReturnByLabel(input: { evidenceId?: string; fixtureId?: 'labelRma8821'; scanValue?: string }): Promise<LabelLookupResult> {
  try {
    const result = await callMcpTool(
      'lookup_return_by_label',
      input,
      labelLookupWireSchema,
      45_000,
    )
    if (!result.returnRecord) throw new Error('RETURN_RECORD_NOT_FOUND')
    return {
      mode: normalizeIntakeMode(result.mode),
      executionMode: result.mode,
      extraction: {
        labelId: result.extraction.labelId,
        trackingNumber: result.extraction.trackingNumber,
        rmaId: result.extraction.rmaId,
        orderId: result.extraction.orderId,
        carrier: result.extraction.carrier,
        confidence: result.extraction.confidence,
        evidenceIds: result.extraction.evidenceIds,
      },
      returnRecord: result.returnRecord,
      matchedBy: result.matchedBy ?? 'RMA',
      warnings: result.warnings,
    }
  } catch (error) {
    if (input.fixtureId) return fallbackLabelLookup()
    throw error
  }
}

export async function analyzeReturnContents(input: {
  returnRecordId: string
  evidenceId?: string
  fixtureId?: IntakeFixtureId
  retakeCount?: number
}): Promise<InspectionResult> {
  try {
    const result = await callMcpTool(
      'analyze_return_contents',
      input,
      inspectionWireResultSchema,
      60_000,
    )
    return {
      mode: normalizeIntakeMode(result.mode),
      executionMode: result.mode,
      inspection: {
        ...result.inspection,
        comparison: {
          ...result.inspection.comparison,
          observedQuantity: result.inspection.comparison.observedQuantity ?? 0,
        },
        warehouseEvidenceImageUrl: result.inspection.warehouseEvidenceImageUrl ?? undefined,
        actionOptions: result.inspection.actionOptions ?? clientActionOptionsFor(result.inspection.classification),
        dispositionRecommendation: result.inspection.dispositionRecommendation
          ?? clientDispositionFor(result.inspection.classification, result.inspection.confidence, result.inspection.missingEvidence),
      },
    }
  } catch (error) {
    if (input.fixtureId) return fallbackInspection(input.fixtureId)
    throw error
  }
}

export async function draftReturnCommunication(input: { inspectionId: string; channel: CommunicationChannel; actionOptionId?: IntakeActionOptionId }): Promise<DraftResult> {
  try {
    const result = await callMcpTool(
      'draft_return_communication',
      input,
      draftWireResultSchema,
      45_000,
    )
    const mode = result.mode ?? (result.draft.generationMode === 'OPENAI' ? 'OPENAI' : 'SAFE_FALLBACK')
    return {
      mode: normalizeIntakeMode(mode),
      executionMode: mode,
      draft: {
        ...result.draft,
        attachments: result.draft.attachments.flatMap((attachment) => {
          const url = attachment.url ?? attachment.sourceUrl
          if (!url) return []
          return [{
            label: attachment.label ?? (attachment.role === 'WAREHOUSE_EVIDENCE' ? 'Warehouse inspection evidence' : 'Original purchased SKU reference'),
            url,
            role: attachment.role,
            altText: attachment.altText,
            provenance: attachment.provenance,
            evidenceId: attachment.evidenceId,
          }]
        }),
      },
    }
  } catch (error) {
    const inspectionFixture = input.inspectionId.match(/^inspection-(.+)-fixture$/)?.[1]
    const fixtureId = intakeFixtureIds.find((candidate) => candidate.toLowerCase() === inspectionFixture)
    if (!fixtureId) throw error
    const config = fallbackInspectionConfigs[fixtureId]
    const channel = input.channel
    const chosenOption = input.actionOptionId ? clientActionOptionCatalog[input.actionOptionId] : undefined
    const intentSentence = chosenOption?.templateIntent === 'RETURN_LABEL_OFFER'
      ? 'If you would like a new prepaid return label, complete the short claim form at {{CLAIM_FORM_LINK}} and a label will follow.'
      : chosenOption?.templateIntent === 'SHIP_ITEM_BACK_REQUEST'
        ? 'When you are able, please ship the remaining item back in its original packaging so a team member can complete the review.'
        : undefined
    return {
      mode: 'fallback',
      executionMode: 'SYNTHETIC_FIXTURE',
      draft: {
        draftId: `draft-${fixtureId.toLowerCase()}-fixture`,
        templateIntent: chosenOption?.templateIntent,
        actionOptionId: chosenOption?.id,
        channel,
        recipient: channel === 'EMAIL' ? fallbackReturnRecord.customer.email : fallbackReturnRecord.customer.phone ?? 'No test recipient',
        subject: channel === 'EMAIL' ? `Update on return ${fallbackReturnRecord.rmaId}` : null,
        body: `Hi ${fallbackReturnRecord.customer.name.split(' ')[0]},\n\nWe completed an initial review of return ${fallbackReturnRecord.rmaId}. ${config.summary}\n\n${config.rationale}${intentSentence ? `\n\n${intentSentence}` : ''}\n\nThis is a reversible review step, not an allegation. You can reply with relevant context or evidence for a human reviewer.\n\nSKIMS Returns`,
        contentSha256: '0'.repeat(64),
        modelAudit: fallbackModelAudit('SAFE_FALLBACK'),
        originalProductImageUrl: fallbackReturnRecord.product.imageUrl,
        warehouseEvidenceImageUrl: config.imageUrl,
        attachments: [
          { label: 'Original purchased SKU reference', url: fallbackReturnRecord.product.imageUrl, role: 'ORIGINAL_PRODUCT_REFERENCE', altText: `Catalog reference for ${fallbackReturnRecord.product.title}`, provenance: `Catalog record · ${fallbackReturnRecord.product.sku}`, evidenceId: null },
          { label: 'Warehouse inspection evidence', url: config.imageUrl, role: 'WAREHOUSE_EVIDENCE', altText: `Synthetic warehouse evidence for ${fallbackReturnRecord.rmaId}`, provenance: `Synthetic fixture · ${fixtureId}`, evidenceId: `fixture:${fixtureId}` },
        ],
      },
    }
  }
}

export async function queueTestCommunication(input: { draftId: string; reviewId: string }): Promise<QueueResult> {
  try {
    const result = await callMcpTool(
      'queue_test_communication',
      input,
      queueWireResultSchema,
      8_000,
    )
    return {
      status: result.status,
      messageId: result.messageId,
      message: typeof result.message === 'string'
        ? result.message
        : 'Queued in the delivery-disabled test outbox. Nothing was sent to a customer.',
      activity: result.activity,
    }
  } catch {
    return {
      status: 'NOT_QUEUED_API_UNAVAILABLE',
      message: 'The test outbox API is unavailable. Nothing was queued or sent.',
    }
  }
}

/** Session-scoped intake activity for the workstation home screen. A fresh
 * session (or an unavailable API) yields an empty feed — the true empty state. */
export async function listIntakeActivity(): Promise<IntakeActivityRecord[]> {
  try {
    const result = await apiRequest('/api/intake/activity', { method: 'GET' }, activityListWireSchema, true, 8_000)
    return result.activity
  } catch {
    try {
      const result = await callMcpTool('list_intake_activity', {}, activityListWireSchema, 8_000)
      return result.activity
    } catch {
      return []
    }
  }
}

const portfolioFromSources = (
  remote: RefundPortfolio | undefined,
  activity: IntakeActivityRecord[],
  from?: string,
  to?: string,
): RefundPortfolio => {
  if (activity.length > 0) return buildRefundPortfolio({ activity, from, to })
  return remote ?? buildRefundPortfolio({ from, to })
}

/** Seeded refund book plus this session's live overlays, optionally bounded
 * by inclusive UTC calendar days. Live activity is overlaid locally so a
 * stale or seed-only API response still shows the box just processed. */
export async function listRefundPortfolio(from?: string, to?: string): Promise<RefundPortfolio> {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString()
  const activity = await listIntakeActivity()
  try {
    const remote = await apiRequest(
      `/api/intake/portfolio${query ? `?${query}` : ''}`,
      { method: 'GET' },
      RefundPortfolioSchema,
      true,
      8_000,
    )
    return portfolioFromSources(remote, activity, from, to)
  } catch {
    try {
      const remote = await callMcpTool(
        'list_refund_portfolio',
        { ...(from ? { from } : {}), ...(to ? { to } : {}) },
        RefundPortfolioSchema,
        8_000,
      )
      return portfolioFromSources(remote, activity, from, to)
    } catch {
      return portfolioFromSources(undefined, activity, from, to)
    }
  }
}

export async function recordReturnReview(input: {
  inspectionId: string
  draftId: string
  reviewerLabel: string
  evidenceIds: string[]
}): Promise<IntakeReview> {
  const result = await callMcpTool(
    'record_return_review',
    {
      ...input,
      acknowledgedRecommendation: true,
      acknowledgedPolicy: true,
      acknowledgedEvidence: true,
      draftDecision: 'APPROVE_AS_WRITTEN',
    },
    intakeReviewWireResultSchema,
    8_000,
  )
  return result.review
}

// ── Operator auth (demo-grade station login) ─────────────────────────────────

const OPERATOR_KEY = 'redo-return-integrity:operator:v1'

const operatorProfileSchema = z.object({
  operatorId: z.string(),
  stationId: z.string(),
  displayName: z.string(),
  role: z.enum(['OPERATOR', 'SUPERVISOR']),
  identityAssurance: z.literal('DEMO_STATION_PIN'),
  loggedInAt: z.string(),
})
export type OperatorProfile = z.infer<typeof operatorProfileSchema>

const loginResponseSchema = z.object({
  sessionToken: z.string().uuid(),
  operator: operatorProfileSchema,
})

/** Reads the locally stored operator profile; null when logged out. */
export function currentOperator(): OperatorProfile | null {
  const raw = sessionStorage.getItem(OPERATOR_KEY)
  if (!raw) return null
  try {
    return operatorProfileSchema.parse(JSON.parse(raw))
  } catch {
    sessionStorage.removeItem(OPERATOR_KEY)
    return null
  }
}

/** Validates the seeded demo station credentials server-side, then binds the
 * issued session token and operator profile to this browser tab. */
export async function loginOperator(stationId: string, pin: string): Promise<OperatorProfile> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ stationId, pin }),
  })
  if (response.status === 401) throw new Error('INVALID_CREDENTIALS')
  if (!response.ok) throw new Error(`Login API ${response.status}`)
  const parsed = loginResponseSchema.parse(await response.json())
  sessionStorage.setItem(API_SESSION_KEY, parsed.sessionToken)
  sessionStorage.setItem(OPERATOR_KEY, JSON.stringify(parsed.operator))
  return parsed.operator
}

export async function logoutOperator(): Promise<void> {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST', body: '{}' }, z.object({ loggedOut: z.boolean() }), true, 3_000)
  } catch {
    // The abandoned demo session expires on its own; local logout still proceeds.
  }
  sessionStorage.removeItem(OPERATOR_KEY)
  sessionStorage.removeItem(API_SESSION_KEY)
}

// ── Operator settings ────────────────────────────────────────────────────────

const dispositionOverridesSchema = z.object({
  MATCH: z.enum(dispositionPreferences),
  EMPTY_BOX: z.enum(dispositionPreferences),
  DAMAGED_PRODUCT: z.enum(dispositionPreferences),
  QUANTITY_MISMATCH: z.enum(dispositionPreferences),
  WRONG_PRODUCT: z.enum(dispositionPreferences),
  POSSIBLE_IMITATION: z.enum(dispositionPreferences),
  WARDROBING: z.enum(dispositionPreferences),
  INCONCLUSIVE: z.enum(dispositionPreferences),
})

const operatorSettingsSchema = z.object({
  passConfidenceThreshold: z.number(),
  maxPhotoRetakes: z.number().int(),
  defaultChannel: z.enum(['EMAIL', 'SMS']),
  voiceCallsEnabled: z.boolean(),
  voice: z.enum(realtimeCallVoices),
  suggestCallOnSetAside: z.boolean(),
  dispositionOverrides: dispositionOverridesSchema,
  updatedAt: z.string().nullable(),
})
export type OperatorSettings = z.infer<typeof operatorSettingsSchema>
export type OperatorSettingsUpdate = Partial<Omit<OperatorSettings, 'updatedAt' | 'dispositionOverrides'>> & {
  dispositionOverrides?: Partial<OperatorSettings['dispositionOverrides']>
}

const settingsResultSchema = z.object({ settings: operatorSettingsSchema })

export async function getOperatorSettings(): Promise<OperatorSettings> {
  const result = await apiRequest('/api/intake/settings', { method: 'GET' }, settingsResultSchema, true, 8_000)
  return result.settings
}

export async function updateOperatorSettings(update: OperatorSettingsUpdate): Promise<OperatorSettings> {
  const result = await apiRequest(
    '/api/intake/settings',
    { method: 'PUT', body: JSON.stringify(update) },
    settingsResultSchema,
    true,
    8_000,
  )
  return result.settings
}

// ── Disposition triage + voice calls ─────────────────────────────────────────

const dispositionRecordWireSchema = z.object({
  dispositionId: z.string(),
  inspectionId: z.string(),
  returnRecordId: z.string(),
  disposition: z.enum(intakeDispositions),
  recommendedDisposition: z.enum(intakeDispositions),
  followedRecommendation: z.boolean(),
  reason: z.string(),
  recordedBy: z.string(),
  recordedAt: z.string(),
}).passthrough()
export type IntakeDispositionRecord = z.infer<typeof dispositionRecordWireSchema>

const dispositionResultSchema = z.object({
  record: dispositionRecordWireSchema,
  activity: intakeActivityWireSchema.optional(),
})

export async function recordIntakeDisposition(input: {
  inspectionId: string
  disposition: IntakeDisposition
  reason?: string
  recordedBy: string
}): Promise<{ record: IntakeDispositionRecord; activity?: IntakeActivityRecord }> {
  return callMcpTool('record_intake_disposition', input, dispositionResultSchema, 8_000)
}

export type SimulatedCallTurn = { speaker: 'AGENT' | 'CUSTOMER'; text: string }

const realtimeCallSessionSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('OPENAI_REALTIME'),
    testMode: z.literal(true),
    clientSecret: z.string(),
    expiresAt: z.string().nullable(),
    model: z.string(),
    voice: z.string(),
    instructions: z.string(),
  }),
  z.object({
    mode: z.literal('SIMULATED'),
    testMode: z.literal(true),
    reason: z.string(),
    script: z.array(z.object({ speaker: z.enum(['AGENT', 'CUSTOMER']), text: z.string() })),
    voice: z.string(),
    instructions: z.string(),
  }),
])
export type RealtimeCallSession = z.infer<typeof realtimeCallSessionSchema>

/** Prepares a test-mode resolution call. With a configured OpenAI key the
 * server mints a short-lived Realtime client secret for a browser WebSocket;
 * otherwise it returns the deterministic scripted call. */
export async function createRealtimeCallSession(input: {
  returnRecordId: string
  inspectionId?: string
}): Promise<RealtimeCallSession> {
  return apiRequest(
    '/api/intake/calls/session',
    { method: 'POST', body: JSON.stringify(input) },
    realtimeCallSessionSchema,
    true,
    15_000,
  )
}

const callRecordWireSchema = z.object({
  callId: z.string(),
  returnRecordId: z.string(),
  inspectionId: z.string().nullable(),
  mode: z.enum(['OPENAI_REALTIME', 'SIMULATED']),
  testMode: z.literal(true),
  startedAt: z.string(),
  endedAt: z.string(),
  durationSeconds: z.number().int(),
  transcriptSha256: z.string(),
  transcriptPreview: z.string(),
  resolution: z.enum(callResolutions),
  resolutionNote: z.string().nullable(),
  operatorLabel: z.string(),
}).passthrough()
export type IntakeCallRecord = z.infer<typeof callRecordWireSchema>

const callOutcomeResultSchema = z.object({
  call: callRecordWireSchema,
  activity: intakeActivityWireSchema,
})

/** Post-call MCP trigger: persists the call outcome and its activity entry. */
export async function recordCallOutcome(input: {
  returnRecordId: string
  inspectionId: string
  mode: 'OPENAI_REALTIME' | 'SIMULATED'
  startedAt: string
  durationSeconds: number
  transcript: string
  resolution: CallResolution
  resolutionNote?: string
  operatorLabel: string
}): Promise<{ call: IntakeCallRecord; activity: IntakeActivityRecord }> {
  return callMcpTool('record_call_outcome', input, callOutcomeResultSchema, 10_000)
}
