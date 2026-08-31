import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { WorkstationShell } from '../components/WorkstationShell'
import { AlertCircle, ArrowLeft, Check, LoaderCircle } from '@/lib/ws-icons'
import {
  getOperatorSettings,
  inspectionClassifications,
  realtimeCallVoices,
  updateOperatorSettings,
  type DispositionPreference,
  type InspectionClassification,
  type OperatorSettings,
  type OperatorSettingsUpdate,
} from '../lib/api'

const preferenceLabels: Record<DispositionPreference, string> = {
  AI_RECOMMEND: 'AI recommends',
  FORCE_PASS: 'Always pass',
  FORCE_MORE_PHOTOS: 'Always take more photos',
  FORCE_SET_ASIDE: 'Always set aside',
}

const classificationLabel = (classification: InspectionClassification) =>
  classification.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (character) => character.toUpperCase())

export function SettingsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<OperatorSettings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    document.title = 'Station settings · Redo'
  }, [])

  const settingsQuery = useQuery({ queryKey: ['operator-settings'], queryFn: getOperatorSettings })
  const settings = draft ?? settingsQuery.data ?? null

  const save = useMutation({
    mutationFn: (update: OperatorSettingsUpdate) => updateOperatorSettings(update),
    onSuccess: (next) => {
      queryClient.setQueryData(['operator-settings'], next)
      setDraft(null)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2_500)
    },
  })

  const edit = (patch: Partial<OperatorSettings>) => {
    if (!settings) return
    setSaved(false)
    setDraft({ ...settings, ...patch })
  }

  const submit = () => {
    if (!settings) return
    const { updatedAt: _updatedAt, ...update } = settings
    save.mutate(update)
  }

  return (
    <WorkstationShell
      topLeft={(
        <Button type="button" variant="ghost" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Workstation
        </Button>
      )}
      actionBar={(
        <Button type="button" size="lg" className="w-full" disabled={!settings || save.isPending || !draft} onClick={submit}>
          {save.isPending ? <LoaderCircle className="ws-spin" size={18} /> : <Check size={18} />}
          {save.isPending ? 'Saving…' : saved ? 'Saved' : 'Save settings'}
        </Button>
      )}
    >
      <h1 className="ws-h">Station settings</h1>
      <p className="ws-sub">How this station handles each situation after the two photos. Applied server-side to the triage recommendation.</p>

      {settingsQuery.isPending ? <p className="ws-activity__empty">Loading settings…</p> : null}
      {settingsQuery.isError ? (
        <Alert variant="destructive">
          <AlertCircle size={15} />
          <AlertDescription>Settings are unavailable. Check that the local API is running.</AlertDescription>
        </Alert>
      ) : null}

      {settings ? (
        <>
          <Card>
            <CardContent className="ws-card__section ws-settings__group pt-4">
              <p className="ws-divider">Triage thresholds</p>
              <div className="grid gap-2">
                <Label htmlFor="pass-threshold">
                  Pass confidence threshold · <span className="ws-mono">{Math.round(settings.passConfidenceThreshold * 100)}%</span>
                </Label>
                <Slider
                  id="pass-threshold"
                  min={50}
                  max={99}
                  step={1}
                  value={[Math.round(settings.passConfidenceThreshold * 100)]}
                  onValueChange={([value]) => edit({ passConfidenceThreshold: value / 100 })}
                  aria-label="Pass confidence threshold percent"
                />
                <small className="text-[11.5px] font-medium text-muted-foreground">Below this confidence, a pass-eligible result asks for more photos instead.</small>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="max-retakes">Photo retakes before forced set-aside</Label>
                <Select
                  value={String(settings.maxPhotoRetakes)}
                  onValueChange={(value) => edit({ maxPhotoRetakes: Number(value) })}
                >
                  <SelectTrigger id="max-retakes"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((count) => (
                      <SelectItem key={count} value={String(count)}>{count}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>

            <CardContent className="ws-card__section ws-settings__group">
              <p className="ws-divider">Per-result handling</p>
              {inspectionClassifications.map((classification) => (
                <div key={classification} className="ws-settings__row">
                  <Label htmlFor={`handling-${classification}`}>{classificationLabel(classification)}</Label>
                  <Select
                    value={settings.dispositionOverrides[classification]}
                    onValueChange={(value) => edit({
                      dispositionOverrides: {
                        ...settings.dispositionOverrides,
                        [classification]: value as DispositionPreference,
                      },
                    })}
                  >
                    <SelectTrigger id={`handling-${classification}`} aria-label={`Handling for ${classificationLabel(classification)}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(preferenceLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>

            <CardContent className="ws-card__section ws-settings__group">
              <p className="ws-divider">Customer contact</p>
              <div className="ws-settings__row">
                <Label htmlFor="default-channel">Default message channel</Label>
                <Select
                  value={settings.defaultChannel}
                  onValueChange={(value) => edit({ defaultChannel: value as OperatorSettings['defaultChannel'] })}
                >
                  <SelectTrigger id="default-channel"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="SMS">Text (SMS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="ws-settings__row">
                <Label htmlFor="voice-calls">Voice calls (OpenAI Realtime, test mode)</Label>
                <Checkbox
                  id="voice-calls"
                  checked={settings.voiceCallsEnabled}
                  onCheckedChange={(checked) => edit({ voiceCallsEnabled: checked === true })}
                  aria-label="Enable voice calls"
                />
              </div>
              <div className="ws-settings__row">
                <Label htmlFor="agent-voice">Agent voice</Label>
                <Select
                  value={settings.voice}
                  disabled={!settings.voiceCallsEnabled}
                  onValueChange={(value) => edit({ voice: value as OperatorSettings['voice'] })}
                >
                  <SelectTrigger id="agent-voice"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {realtimeCallVoices.map((voice) => (
                      <SelectItem key={voice} value={voice}>{voice}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="ws-settings__row">
                <Label htmlFor="suggest-call">Suggest a call when a box is set aside</Label>
                <Checkbox
                  id="suggest-call"
                  checked={settings.suggestCallOnSetAside}
                  disabled={!settings.voiceCallsEnabled}
                  onCheckedChange={(checked) => edit({ suggestCallOnSetAside: checked === true })}
                  aria-label="Suggest call on set aside"
                />
              </div>
            </CardContent>
          </Card>
          {save.isError ? (
            <Alert variant="destructive">
              <AlertCircle size={15} />
              <AlertDescription>Settings were not saved. Try again.</AlertDescription>
            </Alert>
          ) : null}
          <p className="ws-note">Settings are session-scoped in this demo and expire with the demo session.</p>
        </>
      ) : null}
    </WorkstationShell>
  )
}
