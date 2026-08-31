import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type ScanStartValue = {
  startScan: (() => void) | null
  setStartScan: (fn: (() => void) | null) => void
  immersive: boolean
  setImmersive: (value: boolean) => void
}

const ScanStartContext = createContext<ScanStartValue | null>(null)

export function ScanStartProvider({ children }: { children: ReactNode }) {
  const [startScan, setStartScan] = useState<(() => void) | null>(null)
  const [immersive, setImmersive] = useState(false)
  const value = useMemo(
    () => ({ startScan, setStartScan, immersive, setImmersive }),
    [startScan, immersive],
  )
  return <ScanStartContext.Provider value={value}>{children}</ScanStartContext.Provider>
}

export function useScanStart(): ScanStartValue {
  const value = useContext(ScanStartContext)
  if (!value) throw new Error('useScanStart must be used inside ScanStartProvider')
  return value
}
