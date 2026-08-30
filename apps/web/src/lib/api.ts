import { z } from 'zod'
import type { Checkpoint, DemoState } from '../domain'

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
] as const

export const inspectionClassifications = [
  'MATCH',
  'EMPTY_BOX',
  'DAMAGED_PRODUCT',
  'QUANTITY_MISMATCH',
  'WRONG_PRODUCT',
  'POSSIBLE_IMITATION',
  'INCONCLUSIVE',
] as const

export type IntakeFixtureId = (typeof intakeFixtureIds)[number]
export type InspectionClassification = (typeof inspectionClassifications)[number]
export type CommunicationChannel = 'EMAIL' | 'SMS'
type IntakeMode = 'live' | 'fallback' | 'unavailable'

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
    templateIntent: z.enum(['APPROVAL', 'PARTIAL_REFUND_EXPLANATION', 'EVIDENCE_REQUEST', 'REVIEW_HOLD', 'APPEAL_NOTICE', 'NONE']),
  }).passthrough(),
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

const queueWireResultSchema = z.object({
  status: z.enum(['QUEUED_TEST_OUTBOX', 'NOT_QUEUED_API_UNAVAILABLE']),
  messageId: z.string().optional(),
  message: z.union([z.string(), z.object({
    status: z.literal('QUEUED_TEST_OUTBOX'),
    deliveryDisabled: z.literal(true),
  }).passthrough()]),
})

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
export type PackageInspection = Omit<InspectionWire, 'comparison' | 'warehouseEvidenceImageUrl'> & {
  comparison: Omit<InspectionWire['comparison'], 'observedQuantity'> & { observedQuantity: number }
  warehouseEvidenceImageUrl?: string
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
  returnRecordId: 'ret-jc-1042',
  merchantId: 'juniper-circuit-demo',
  merchantName: 'Juniper Circuit',
  labelId: 'LBL-8821',
  rmaId: 'RMA-8821',
  orderId: 'JC-1042',
  trackingNumber: '1Z-REDO-8821',
  carrier: 'UPS',
  customer: {
    customerId: 'demo-shopper-001',
    name: 'Avery Demo',
    email: 'avery.return@example.test',
    phone: '+1-555-010-8821',
  },
  product: {
    sku: 'JC-ARC-ONE-KIT',
    title: 'Juniper Arc One two-camera kit',
    quantity: 2,
    unitPriceCents: 92_450,
    totalEligibleRefundCents: 184_900,
    imageUrl: '/evidence/catalog-juniper-arc-one.png',
    serials: ['JCA1-88K2', 'JCA1-91M7'],
    attributes: { variant: 'Matte black / two pack', expectedPackedWeight: '1800 g' },
  },
  return: {
    reason: 'Changed mind',
    requestedRefundCents: 184_900,
    currency: 'USD',
    policyId: 'juniper-return-policy',
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
    summary: 'Two camera bodies matching the expected form factor and catalog reference are visible. Quantity and the two readable serials match the order record.',
    description: 'Two Juniper Arc One camera bodies', candidateSku: 'JC-ARC-ONE-KIT', quantity: 2, condition: 'Received · no visible damage',
    nextAction: 'APPROVE_FULL', recommendedType: 'FULL', recommendedAmountCents: 184_900, withholdAmountCents: 0,
    rationale: 'Expected SKU, quantity, and serials are observed. Merchant review is still required before funds move.',
    templateIntent: 'APPROVAL', imageUrl: '/evidence/return-matching-contents.png',
  },
  emptyReturn: {
    classification: 'EMPTY_BOX', confidence: 0.93,
    summary: 'No merchandise is visible in the opened parcel. The complete capture sequence shows packaging material only; expected quantity is two.',
    description: 'No merchandise observed', candidateSku: null, quantity: 0, condition: 'Empty container',
    nextAction: 'REQUEST_MORE_EVIDENCE', recommendedType: 'TEMPORARY_HOLD', recommendedAmountCents: null, withholdAmountCents: 184_900,
    rationale: 'Temporarily hold the requested refund while a reviewer verifies the capture protocol and gives the shopper a cure path.',
    templateIntent: 'EVIDENCE_REQUEST', imageUrl: '/evidence/return-empty-box.png',
  },
  quantityMismatch: {
    classification: 'QUANTITY_MISMATCH', confidence: 0.91,
    summary: 'One camera body is visible although the authorized return and order record expect two. One purchased serial is readable.',
    description: 'One Juniper Arc One camera body', candidateSku: 'JC-ARC-ONE-KIT', quantity: 1, condition: 'Received · one unit absent',
    nextAction: 'APPROVE_PARTIAL', recommendedType: 'PARTIAL', recommendedAmountCents: 92_450, withholdAmountCents: 92_450,
    rationale: 'The policy-calculated ceiling is one eligible unit. A human must confirm line-item value and any shopper evidence.',
    templateIntent: 'PARTIAL_REFUND_EXPLANATION', imageUrl: '/evidence/return-quantity-mismatch.png',
    missingEvidence: ['Second unit or pre-handoff packing evidence'],
  },
  wrongItem: {
    classification: 'WRONG_PRODUCT', confidence: 0.89,
    summary: 'The visible item does not match the ordered camera kit in shape, markings, or catalog attributes. No expected serial is visible.',
    description: 'Unrelated compact electronics item', candidateSku: 'UNMATCHED', quantity: 1, condition: 'Received · wrong item',
    nextAction: 'HOLD_FOR_REVIEW', recommendedType: 'TEMPORARY_HOLD', recommendedAmountCents: null, withholdAmountCents: 184_900,
    rationale: 'Keep the refund reversible while a reviewer confirms SKU mismatch and invites a shopper explanation.',
    templateIntent: 'REVIEW_HOLD', imageUrl: '/evidence/return-wrong-item.png',
  },
  damagedProduct: {
    classification: 'DAMAGED_PRODUCT', confidence: 0.86,
    summary: 'The expected product family and quantity are visible. One housing shows apparent impact damage that requires human condition grading.',
    description: 'Two Juniper Arc One camera bodies', candidateSku: 'JC-ARC-ONE-KIT', quantity: 2, condition: 'One unit has visible housing damage',
    nextAction: 'HOLD_FOR_REVIEW', recommendedType: 'NO_RECOMMENDATION', recommendedAmountCents: null, withholdAmountCents: null,
    rationale: 'A photo cannot establish policy eligibility, causation, or salvage value. A human must grade the item and apply the merchant policy before choosing refund cents.',
    templateIntent: 'EVIDENCE_REQUEST', imageUrl: '/evidence/return-damaged-product.png',
    missingEvidence: ['Second-angle damage photo', 'Operator condition grade'],
  },
  possibleImitation: {
    classification: 'POSSIBLE_IMITATION', confidence: 0.72,
    summary: 'The item resembles the catalog product, but visible markings and serial placement differ. The image alone cannot establish authenticity.',
    description: 'Camera-like item with inconsistent markings', candidateSku: 'JC-ARC-ONE-KIT?', quantity: 1, condition: 'Authentication unresolved',
    nextAction: 'ROUTE_AUTHENTICATION', recommendedType: 'TEMPORARY_HOLD', recommendedAmountCents: null, withholdAmountCents: 184_900,
    rationale: 'Do not infer counterfeit status from an image. Route to independent authentication and preserve a shopper contest path.',
    templateIntent: 'REVIEW_HOLD', imageUrl: '/evidence/return-imitation.png',
    missingEvidence: ['Independent authentication', 'Macro serial-label image', 'Second product angle'],
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
      missingEvidence: config.missingEvidence ?? [],
      evidenceIds: [`fixture:${fixtureId}`, 'fixture:labelRma8821', 'fixture:catalog-juniper-arc-one'],
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
      },
    }
  } catch (error) {
    if (input.fixtureId) return fallbackInspection(input.fixtureId)
    throw error
  }
}

export async function draftReturnCommunication(input: { inspectionId: string; channel: CommunicationChannel }): Promise<DraftResult> {
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
    return {
      mode: 'fallback',
      executionMode: 'SYNTHETIC_FIXTURE',
      draft: {
        draftId: `draft-${fixtureId.toLowerCase()}-fixture`,
        channel,
        recipient: channel === 'EMAIL' ? fallbackReturnRecord.customer.email : fallbackReturnRecord.customer.phone ?? 'No test recipient',
        subject: channel === 'EMAIL' ? `Update on return ${fallbackReturnRecord.rmaId}` : null,
        body: `Hi ${fallbackReturnRecord.customer.name.split(' ')[0]},\n\nWe completed an initial review of return ${fallbackReturnRecord.rmaId}. ${config.summary}\n\n${config.rationale}\n\nThis is a reversible review step, not an allegation. You can reply with relevant context or evidence for a human reviewer.\n\nJuniper Circuit Returns`,
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
    }
  } catch {
    return {
      status: 'NOT_QUEUED_API_UNAVAILABLE',
      message: 'The test outbox API is unavailable. Nothing was queued or sent.',
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
