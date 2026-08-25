import { AlertCircle, ArrowRight, Check, CheckCircle2, Clock3, CreditCard, FileUp, Headphones, MailCheck, PackageOpen, ReceiptText, RefreshCw, ShieldCheck, Smartphone, Upload, UserCheck, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Badge, EmptyNotice, PageIntro } from '../components/ui'
import { formatStatus } from '../domain'
import { useDemo } from '../lib/demo-context'

type Tab = 'checkout' | 'return' | 'appeal'

export function ShopperPage() {
  const { state, update } = useDemo()
  const [tab, setTab] = useState<Tab>('checkout')
  const [receiptName, setReceiptName] = useState('')
  const [receiptError, setReceiptError] = useState('')
  const [appealText, setAppealText] = useState('I used the same box for two returns. The other item may have been sent under this label. I can provide both drop-off receipts.')
  const fileRef = useRef<HTMLInputElement>(null)

  const verify = (method: NonNullable<typeof state.checkoutMethod>) => update({ checkout: 'cleared', checkoutMethod: method })

  return (
    <div className="page shopper-page">
      <PageIntro eyebrow="SHOPPER EXPERIENCE" title={<>Suspicion should feel like a <em>solvable task.</em></>} description="Juniper Circuit shoppers see exactly what is needed, why it is needed, how long it will take, and what alternatives remain. A failed or declined challenge is never labeled fraud." actions={<Badge tone="green" icon={ShieldCheck}>Good-actor recovery first</Badge>} />

      <div className="persona-bar">
        <div className="avatar avatar--shopper">AM</div>
        <div><small>Signed in as shopper</small><strong>Alex Morgan · Order #JC-1042</strong></div>
        <span className="persona-bar__spacer" />
        <Badge tone={state.checkout === 'cleared' ? 'green' : 'orange'}>{state.checkout === 'cleared' ? 'Order verified' : 'Action available'}</Badge>
      </div>

      <div className="tabs" role="tablist" aria-label="Shopper demo journeys">
        <button role="tab" aria-selected={tab === 'checkout'} className={tab === 'checkout' ? 'active' : ''} onClick={() => setTab('checkout')}><CreditCard aria-hidden="true" /> Checkout challenge</button>
        <button role="tab" aria-selected={tab === 'return'} className={tab === 'return' ? 'active' : ''} onClick={() => setTab('return')}><ReceiptText aria-hidden="true" /> Return handoff</button>
        <button role="tab" aria-selected={tab === 'appeal'} className={tab === 'appeal' ? 'active' : ''} onClick={() => setTab('appeal')}><RefreshCw aria-hidden="true" /> Contest & appeal</button>
      </div>

      {tab === 'checkout' ? (
        <section className="journey-layout" aria-label="Checkout verification">
          <article className="shopper-task">
            <header className="shopper-task__header">
              <span className={`status-orb ${state.checkout === 'cleared' ? 'status-orb--good' : ''}`}>{state.checkout === 'cleared' ? <Check aria-hidden="true" /> : '1'}</span>
              <div><Badge tone={state.checkout === 'cleared' ? 'green' : 'orange'}>{state.checkout === 'cleared' ? 'COMPLETE' : 'ABOUT 1 MINUTE'}</Badge><h2>{state.checkout === 'cleared' ? 'Thanks — your order is moving.' : 'One quick check before we ship'}</h2></div>
            </header>
            {state.checkout === 'cleared' ? (
              <div className="success-panel"><CheckCircle2 aria-hidden="true" /><div><strong>Order #JC-1042 is released</strong><p>You verified using {formatStatus(state.checkoutMethod ?? 'alternate method')}. This check does not add a fraud label to your account.</p></div></div>
            ) : (
              <>
                <p>Your $1,849 order is shipping to a new address. Juniper Circuit asks for one additional proof that you control the payment or contact method. This is not an accusation.</p>
                <div className="why-card"><AlertCircle aria-hidden="true" /><div><strong>Why am I seeing this?</strong><span>New delivery address + high order value. We do not use protected traits or infer identity from your photos.</span></div></div>
                <div className="verification-options">
                  <button onClick={() => verify('email-payment')}><span><MailCheck aria-hidden="true" /><div><strong>Email + payment check</strong><small>Code to alex@example.com and card ending 2048</small></div></span><ArrowRight aria-hidden="true" /></button>
                  <button onClick={() => verify('3ds')}><span><Smartphone aria-hidden="true" /><div><strong>Verify with your bank</strong><small>Secure 3DS approval; no ID document shared with Juniper</small></div></span><ArrowRight aria-hidden="true" /></button>
                  <button onClick={() => verify('support')}><span><Headphones aria-hidden="true" /><div><strong>Use assisted support</strong><small>Accessibility-friendly review with a trained teammate</small></div></span><ArrowRight aria-hidden="true" /></button>
                </div>
                <p className="gentle-note"><X aria-hidden="true" size={15} /> If you leave, we record “challenge not completed,” not “fraud.” Inventory is held for 30 minutes.</p>
              </>
            )}
          </article>
          <aside className="order-summary">
            <span className="eyebrow">ORDER SUMMARY</span>
            <div className="product-mini"><div className="product-mini__art"><PackageOpen aria-hidden="true" /></div><div><strong>Juniper Arc One</strong><span>2-camera field kit · Graphite</span><small>2 cameras · 1 kit</small></div><b>$1,849.00</b></div>
            <dl><div><dt>Shipping</dt><dd>Complimentary</dd></div><div><dt>Tax</dt><dd>$137.21</dd></div><div><dt>Total</dt><dd>$1,986.21</dd></div></dl>
            <p><Clock3 size={14} aria-hidden="true" /> Ships today after verification</p>
          </aside>
        </section>
      ) : null}

      {tab === 'return' ? (
        <section className="journey-layout" aria-label="Return handoff evidence">
          <article className="shopper-task">
            <header className="shopper-task__header"><span className={`status-orb ${state.reverseLogistics === 'cleared' ? 'status-orb--good' : ''}`}>{state.reverseLogistics === 'cleared' ? <Check /> : '!'}</span><div><Badge tone={state.reverseLogistics === 'cleared' ? 'green' : 'orange'}>{state.reverseLogistics === 'cleared' ? 'RESOLVED' : 'RETURN PAUSED'}</Badge><h2>{state.reverseLogistics === 'cleared' ? 'Your return is moving again.' : 'Help us confirm your drop-off'}</h2></div></header>
            {state.reverseLogistics === 'cleared' ? <div className="success-panel"><CheckCircle2 /><div><strong>Receipt matched return RMA-8821</strong><p>The carrier’s delayed scan caused the route mismatch. Your refund timing is restored and no adverse label was applied.</p></div></div> : <>
              <p>The carrier reported a scan 620 miles from your selected drop-off only 18 minutes after label creation. That route is physically inconsistent, but carrier scans can be delayed or wrong.</p>
              <div className="timeline-mini"><span><i className="good" />10:02 AM<small>QR label created · Denver, CO</small></span><span><i className="warn" />10:20 AM<small>Carrier ingest · Omaha, NE</small></span></div>
              <div className="upload-zone" onClick={() => fileRef.current?.click()} onKeyDown={(event) => { if (event.key === 'Enter') fileRef.current?.click() }} role="button" tabIndex={0}><Upload aria-hidden="true" /><strong>{receiptName || 'Select a staffed drop-off receipt image'}</strong><span>JPEG, PNG, or WebP · up to 5 MB · local demo selection only, not uploaded</span><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setReceiptError('Choose a JPEG, PNG, or WebP image no larger than 5 MB.'); setReceiptName(''); return } setReceiptError(''); setReceiptName(file.name); update({ reverseLogistics: 'receipt-reviewed' }) }} /></div>
              {receiptError ? <p className="field-error" role="alert">{receiptError}</p> : null}
              <button className="button button--primary" disabled={!receiptName && state.reverseLogistics !== 'receipt-reviewed'} onClick={() => update({ reverseLogistics: 'cleared' })}><FileUp aria-hidden="true" size={17} /> Match receipt and continue</button>
              <p className="gentle-note">Don’t have a receipt? Choose carrier pickup attestation or ask support to open a trace. Your return stays open during the 72-hour cure window.</p>
            </>}
          </article>
          <aside className="explain-card"><Badge tone="violet">HOW THE DECISION CHANGED</Badge><h3>Contradiction, then corroboration.</h3><ol><li><strong>Native event</strong><span>Carrier ingest location conflicts with authorized origin.</span></li><li><strong>Deterministic check</strong><span>620 miles / 18 minutes is impossible for ground transport.</span></li><li><strong>Shopper cure</strong><span>A staffed receipt can prove timely possession even if carrier data is late.</span></li><li><strong>Result</strong><span>Clear the hold or open a carrier trace — never auto-deny.</span></li></ol></aside>
        </section>
      ) : null}

      {tab === 'appeal' ? (
        <section className="journey-layout" aria-label="Shopper contest and appeal">
          <article className="shopper-task">
            {state.physical !== 'denied' && state.physical !== 'appealed' && state.physical !== 'evidence-ready' ? <EmptyNotice icon={ShieldCheck} title="No adverse decision to contest">A shopper appeal becomes available only after an authorized merchant reviewer makes an adverse decision. The model cannot create one.</EmptyNotice> : <>
              <header className="shopper-task__header"><span className="status-orb">!</span><div><Badge tone={state.physical === 'appealed' ? 'blue' : 'orange'}>{state.physical === 'appealed' ? 'SECOND REVIEW PENDING' : '48-HOUR CONTEST WINDOW'}</Badge><h2>{state.physical === 'appealed' ? 'Your evidence is preserved.' : 'Tell us what we may have missed'}</h2></div></header>
              <p>Juniper Circuit’s reviewer found no Arc One camera kit in the returned parcel. You can correct the record before the refund decision becomes final.</p>
              <label className="field-label">Your explanation<textarea rows={5} value={appealText} disabled={state.physical === 'appealed'} onChange={(event) => setAppealText(event.target.value)} /></label>
              <div className="upload-zone upload-zone--small"><Upload aria-hidden="true" /><strong>Add receipts, photos, or carrier correspondence</strong><span>Optional in this demo</span></div>
              <button className="button button--primary" disabled={state.physical === 'appealed' || !appealText.trim()} onClick={() => update({ physical: 'appealed' })}><RefreshCw size={17} aria-hidden="true" /> {state.physical === 'appealed' ? 'Appeal received' : 'Submit for a second human review'}</button>
              <p className="gentle-note">Submitting an appeal pauses the timer. The second reviewer sees the original evidence and your new evidence; no history is overwritten.</p>
            </>}
          </article>
          <aside className="deadline-card"><Clock3 aria-hidden="true" /><small>CONTEST WINDOW</small><strong>{state.physical === 'appealed' ? 'Paused' : '47:18:32'}</strong><span>Payment evidence status</span><b>Not submitted</b><p>An evidence-ready package is not represented as a chargeback, win, or submission.</p></aside>
        </section>
      ) : null}
    </div>
  )
}
