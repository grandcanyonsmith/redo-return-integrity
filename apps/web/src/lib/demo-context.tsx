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

const readState = (): DemoState => {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    return saved ? (JSON.parse(saved) as DemoState) : newDemoState()
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
