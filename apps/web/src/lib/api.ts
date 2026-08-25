import { z } from 'zod'
import type { Checkpoint, DemoState } from '../domain'

const assessmentSchema = z.object({
  caseId: z.string().optional(),
  checkpointId: z.string(),
  recommendation: z.string(),
  summary: z.string(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  evidenceIds: z.array(z.string()).default([]),
  missingEvidence: z.array(z.string()).default([]),
  mode: z.enum(['live', 'unavailable', 'fallback']).optional(),
})

export type Assessment = z.infer<typeof assessmentSchema> & {
  mode: 'live' | 'unavailable' | 'fallback'
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
    const responseSchema = z.object({
      decision: z.object({
        checkpointId: z.string(),
        openAIAssessment: z.object({
          status: z.enum(['PASS', 'CONCERN', 'INCONCLUSIVE', 'ERROR']),
          confidence: z.number().min(0).max(1),
          summary: z.string(),
          recommendedDisposition: z.string(),
          riskIndicators: z.array(z.object({ evidenceIds: z.array(z.string()) })),
          exculpatoryIndicators: z.array(z.object({ evidenceIds: z.array(z.string()) })),
          imageFindings: z.array(z.object({ evidenceId: z.string() })),
          missingInformation: z.array(z.string()),
        }),
      }),
      model: z.object({ simulated: z.boolean() }),
    })
    const result = await apiRequest(
      `/api/cases/${caseId}/checkpoints/${checkpoint.id}/evaluate`,
      {
        method: 'POST',
        body: JSON.stringify({ simulate: false, physicalFinding: state.physicalFinding }),
      },
      responseSchema,
      true,
      45_000,
    )
    const model = result.decision.openAIAssessment
    const evidenceIds = [
      ...model.riskIndicators.flatMap((indicator) => indicator.evidenceIds),
      ...model.exculpatoryIndicators.flatMap((indicator) => indicator.evidenceIds),
      ...model.imageFindings.map((finding) => finding.evidenceId),
    ]
    return assessmentSchema.parse({
      caseId,
      checkpointId: result.decision.checkpointId,
      recommendation: model.recommendedDisposition,
      summary: model.summary,
      confidence: model.confidence,
      evidenceIds: [...new Set(evidenceIds)],
      missingEvidence: model.missingInformation,
      mode: result.model.simulated ? 'fallback' : model.status === 'ERROR' ? 'unavailable' : 'live',
    }) as Assessment
  } catch {
    return {
      checkpointId: checkpoint.id,
      recommendation: checkpoint.assessment.detail.includes('abstain') ? 'ABSTAIN' : 'HUMAN_REVIEW',
      summary: checkpoint.assessment.detail,
      confidence: null,
      evidenceIds: [`fixture:${checkpoint.id.toLowerCase()}`],
      missingEvidence: checkpoint.evidenceTier === 'E4' || checkpoint.evidenceTier === 'E5' ? [] : ['Additional corroborating evidence'],
      mode: 'fallback',
    }
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
