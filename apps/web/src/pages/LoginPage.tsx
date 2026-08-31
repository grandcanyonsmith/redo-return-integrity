import { useMutation } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { RedoBrand } from '../components/RedoBrand'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { currentOperator, loginOperator } from '../lib/api'
import { AlertCircle, KeyRound, LoaderCircle, LogIn } from '@/lib/ws-icons'
import '../intake-app.css'

const demoLogins = [
  { stationId: 'STN-04', pin: '0404', label: 'Station 04 operator' },
  { stationId: 'STN-07', pin: '0707', label: 'Station 07 operator' },
  { stationId: 'SUP-01', pin: '1111', label: 'Shift supervisor' },
]

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [stationId, setStationId] = useState('STN-04')
  const [pin, setPin] = useState('')

  useEffect(() => {
    document.title = 'Sign in · Redo'
  }, [])

  const login = useMutation({
    mutationFn: () => loginOperator(stationId.trim(), pin.trim()),
    onSuccess: () => {
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
      navigate(from && from !== '/login' ? from : '/', { replace: true })
    },
  })

  if (currentOperator()) return <Navigate to="/" replace />

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!login.isPending && stationId.trim() && pin.trim()) login.mutate()
  }

  return (
    <div className="ws-app ws-login-page">
      <main className="ws-login" aria-label="Workstation sign in">
        <Card className="ws-login__card">
          <form onSubmit={submit}>
            <CardHeader className="ws-login__head">
              <RedoBrand product="Intake" />
              <CardTitle>Station sign in</CardTitle>
              <CardDescription>Warehouse return workstation · demo credentials only</CardDescription>
            </CardHeader>
            <CardContent className="ws-login__form">
              <div className="grid gap-1.5">
                <Label htmlFor="station-id">Station ID</Label>
                <Input
                  id="station-id"
                  value={stationId}
                  onChange={(event) => setStationId(event.target.value)}
                  autoComplete="username"
                  placeholder="STN-04"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="station-pin">PIN</Label>
                <Input
                  id="station-pin"
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  placeholder="••••"
                  required
                />
              </div>
              {login.isError ? (
                <Alert variant="destructive">
                  <AlertCircle size={15} />
                  <AlertDescription>
                    {login.error instanceof Error && login.error.message === 'INVALID_CREDENTIALS'
                      ? 'That station ID and PIN did not match. Use a demo login below.'
                      : 'Sign-in is unavailable right now. Check that the local API is running.'}
                  </AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" size="lg" className="w-full" disabled={login.isPending || !stationId.trim() || !pin.trim()}>
                {login.isPending ? <LoaderCircle className="ws-spin" size={18} /> : <LogIn size={18} />}
                {login.isPending ? 'Signing in…' : 'Sign in'}
              </Button>
            </CardContent>
            <CardContent>
              <p className="ws-divider">Demo logins</p>
              <div className="ws-login__demos">
                {demoLogins.map((demo) => (
                  <Button
                    key={demo.stationId}
                    type="button"
                    variant="secondary"
                    className="ws-login__demo h-auto min-h-11 w-full justify-start whitespace-normal"
                    onClick={() => { setStationId(demo.stationId); setPin(demo.pin) }}
                  >
                    <KeyRound size={13} />
                    <span className="ws-mono">{demo.stationId}</span> · PIN <span className="ws-mono">{demo.pin}</span>
                    <small>{demo.label}</small>
                  </Button>
                ))}
              </div>
              <p className="ws-note">Seeded synthetic operators for this demo. No real credentials or identity verification exist here.</p>
            </CardContent>
          </form>
        </Card>
      </main>
    </div>
  )
}
