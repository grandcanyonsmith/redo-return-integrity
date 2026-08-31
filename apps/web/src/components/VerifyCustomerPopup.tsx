import { useEffect, useState } from 'react'
import { Check, Lock, MapPin, Shield } from 'lucide-react'
import type { VerifyChoice, VerifyModule } from '@return-integrity/domain/verify-modules'

type PopupPhase = 'choose' | 'location' | 'done'

const iconFor = (choice: VerifyChoice) => {
  if (/pickup|location|melrose|locker|staffed|visit/i.test(`${choice.id} ${choice.label}`)) return MapPin
  return Shield
}

export function VerifyCustomerPopup({
  module,
  testing = false,
  onNeedAnotherWay,
  onChooseAnotherOption,
}: {
  module: VerifyModule
  testing?: boolean
  onNeedAnotherWay: () => void
  onChooseAnotherOption: () => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [phase, setPhase] = useState<PopupPhase>('choose')
  const [chosenLabel, setChosenLabel] = useState('')

  useEffect(() => {
    setSelectedId(null)
    setPhase('choose')
    setChosenLabel('')
  }, [module.id])

  const continueEnabled = selectedId !== null
  const selected = module.choices.find((choice) => choice.id === selectedId)

  const finish = (label: string) => {
    setChosenLabel(label)
    setPhase('done')
  }

  const onContinue = () => {
    if (!selected) return
    if (selected.id === 'need-another-way') {
      onNeedAnotherWay()
      return
    }
    if (selected.id === 'another-secure-option') {
      onChooseAnotherOption()
      return
    }
    if (selected.id === 'select-location') {
      setPhase('location')
      setSelectedId(null)
      return
    }
    finish(selected.label)
  }

  return (
    <aside className="vc-phone-col" aria-label="Customer preview">
      <p className="vc-phone-kicker">{testing ? 'Test · customer preview' : 'Customer preview'}</p>
      <div className="vc-phone">
        <div className="vc-phone__bar">
          <span>{module.customerEyebrow}</span>
          <span>Step {module.customerStep.current} of {module.customerStep.of}</span>
        </div>
        <div className="vc-steps" aria-hidden="true">
          {[1, 2, 3].map((step) => (
            <i
              key={step}
              data-done={step < module.customerStep.current || phase === 'done'}
              data-current={phase !== 'done' && step === module.customerStep.current}
            />
          ))}
        </div>

        {phase === 'done' ? (
          <div className="vc-success">
            <div className="vc-lock" aria-hidden="true"><Check size={24} /></div>
            <h2>You’re all set.</h2>
            <p>Privileges are restored. {chosenLabel} is confirmed, and this order continues.</p>
            <p className="vc-safe"><Check size={16} aria-hidden="true" /> No adverse label was added.</p>
          </div>
        ) : null}

        {phase === 'choose' ? (
          <>
            <div className="vc-lock" aria-hidden="true"><Lock size={22} /></div>
            <h2>{module.customerTitle}</h2>
            <p>{module.customerBody}</p>
            <div className="vc-options" role="group" aria-label="Secure options">
              {module.choices.map((choice) => {
                const Icon = iconFor(choice)
                return (
                  <button
                    key={choice.id}
                    type="button"
                    className="vc-option"
                    aria-pressed={selectedId === choice.id}
                    onClick={() => setSelectedId(choice.id)}
                  >
                    <span className="vc-option__icon"><Icon size={16} aria-hidden="true" /></span>
                    <span>
                      <b>{choice.label}</b>
                      <small>{choice.detail}</small>
                    </span>
                  </button>
                )
              })}
            </div>
            <button type="button" className="vc-continue" disabled={!continueEnabled} onClick={onContinue}>
              Continue
            </button>
            <p className="vc-reserved">Your order is reserved.</p>
            <p className="vc-safe"><Check size={16} aria-hidden="true" /> No order cancellation required.</p>
          </>
        ) : null}

        {phase === 'location' ? (
          <>
            <div className="vc-lock" aria-hidden="true"><MapPin size={22} /></div>
            <h2>Select a location.</h2>
            <p>Your QR code will work only at the stop you choose.</p>
            <div className="vc-options" role="group" aria-label="Return locations">
              {[
                { id: 'melrose', label: 'SKIMS Melrose', detail: 'Staffed boutique · 0.8 mi' },
                { id: 'third', label: 'Staffed locker · 3rd St', detail: 'Open until 8pm · 1.4 mi' },
              ].map((place) => (
                <button
                  key={place.id}
                  type="button"
                  className="vc-option"
                  aria-pressed={selectedId === place.id}
                  onClick={() => setSelectedId(place.id)}
                >
                  <span className="vc-option__icon"><MapPin size={16} aria-hidden="true" /></span>
                  <span><b>{place.label}</b><small>{place.detail}</small></span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="vc-continue"
              disabled={!selectedId}
              onClick={() => finish('Secure return QR')}
            >
              Get QR code
            </button>
            <button type="button" className="vc-option" style={{ marginTop: 8 }} onClick={onNeedAnotherWay}>
              <span className="vc-option__icon"><Shield size={16} aria-hidden="true" /></span>
              <span><b>Need another way?</b><small>Open an independent review.</small></span>
            </button>
          </>
        ) : null}
      </div>
    </aside>
  )
}
