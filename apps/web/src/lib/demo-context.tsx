import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { newDemoState, type DemoState } from '../domain'
import { initializeApiSession, resetApiSession } from './api'

type DemoContextValue = {
  state: DemoState
  update: (patch: Partial<DemoState>) => void
  reset: () => Promise<void>
}

const STORAGE_KEY = 'redo-return-integrity:demo:v1'
const DemoContext = createContext<DemoContextValue | null>(null)

const allowedValues = {
  checkout: ['challenged', 'cleared'],
  reverseLogistics: ['inconsistent', 'receipt-reviewed', 'cleared'],
  physical: ['inspection-hold', 'review-pending', 'approved', 'partial', 'denied', 'appealed', 'overturned', 'evidence-ready'],
  physicalFinding: ['empty', 'decoy', 'wrong-item', 'possible-imitation', 'quantity-mismatch', 'inconclusive'],
} as const

// Persisted state is untrusted (a stale schema, hand-edited storage, or a
// corrupt value must never crash the app or break status rendering). Accept it
// only when every enum field is a known value; otherwise start fresh.
const isValidDemoState = (value: unknown): value is DemoState => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  if (typeof candidate.sessionId !== 'string' || candidate.sessionId.length === 0) return false
  return (Object.keys(allowedValues) as Array<keyof typeof allowedValues>).every(
    (key) => typeof candidate[key] === 'string' && (allowedValues[key] as readonly string[]).includes(candidate[key] as string),
  )
}

const readState = (): DemoState => {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (!saved) return newDemoState()
    const parsed: unknown = JSON.parse(saved)
    return isValidDemoState(parsed) ? parsed : newDemoState()
  } catch {
    return newDemoState()
  }
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoState>(readState)

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    // Warm the isolated server session so the first explicit model evaluation
    // does not pay session-creation latency. Offline previews continue safely.
    void initializeApiSession().catch(() => undefined)
  }, [])

  const update = useCallback((patch: Partial<DemoState>) => {
    setState((current) => ({ ...current, ...patch }))
  }, [])

  const reset = useCallback(async () => {
    try {
      await resetApiSession()
    } catch {
      // Offline previews still reset their isolated local fixture state.
    }
    const fresh = newDemoState()
    setState(fresh)
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
  }, [])

  const value = useMemo(() => ({ state, update, reset }), [state, update, reset])

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

export function useDemo() {
  const context = useContext(DemoContext)
  if (!context) throw new Error('useDemo must be used inside DemoProvider')
  return context
}
