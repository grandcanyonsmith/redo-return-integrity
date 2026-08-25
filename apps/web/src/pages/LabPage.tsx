import { AlertCircle, ArrowRight, BarChart3, Beaker, BrainCircuit, Calculator, Check, CircleDollarSign, FlaskConical, Gauge, Info, Scale, ShieldCheck, SlidersHorizontal, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, PageIntro } from '../components/ui'

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 })

const workedWaterfall = [
  { stage: 'Checkout identity', checkpoints: '01–04', entering: 20, eligible: 16, observable: 12, prevented: 4.21, residual: 15.79, cohort: 'Broad' },
  { stage: 'Pre-fulfillment', checkpoints: '05–07', entering: 15.79, eligible: 5.53, observable: 4.97, prevented: .99, residual: 14.79, cohort: 'Integrated' },
  { stage: 'Return request', checkpoints: '08–09', entering: 14.79, eligible: 14.79, observable: 10.36, prevented: 1.94, residual: 12.86, cohort: 'Broad' },
  { stage: 'Drop-off & transit', checkpoints: '10–11', entering: 12.86, eligible: 9, observable: 7.2, prevented: 1.43, residual: 11.43, cohort: 'Integrated' },
  { stage: 'Managed inspection', checkpoints: '12–13', entering: 4.57, eligible: 4.57, observable: 4.13, prevented: 3.18, residual: 1.4, cohort: 'Managed' },
  { stage: 'Partner evidence', checkpoints: '12–13', entering: 6.86, eligible: 6.86, observable: 1.34, prevented: .44, residual: 6.42, cohort: 'Nonwarehouse' },
  { stage: 'Managed adjudication', checkpoints: '14–15', entering: 1.4, eligible: 1.4, observable: 1.19, prevented: .69, residual: .71, cohort: 'Managed' },
  { stage: 'Partner adjudication', checkpoints: '14–15', entering: 6.42, eligible: 6.42, observable: 3.13, prevented: 1.06, residual: 5.36, cohort: 'Nonwarehouse' },
] as const

export function LabPage() {
  const [gmv, setGmv] = useState(200_000_000)
  const [returnRate, setReturnRate] = useState(20)
  const [fraudRate, setFraudRate] = useState(10)
  const [addressable, setAddressable] = useState(35)
  const [controlLoss, setControlLoss] = useState(2.4)
  const [treatmentLoss, setTreatmentLoss] = useState(1.8)
  const [falsePositive, setFalsePositive] = useState(1.8)

  const result = useMemo(() => {
    const returns = gmv * returnRate / 100
    const modeledLoss = returns * fraudRate / 100
    const addressableLoss = modeledLoss * addressable / 100
    const causalRelativeLift = controlLoss > 0 ? Math.max(0, (controlLoss - treatmentLoss) / controlLoss) : 0
    const estimatedPrevented = addressableLoss * causalRelativeLift
    return { returns, modeledLoss, addressableLoss, causalRelativeLift, estimatedPrevented }
  }, [gmv, returnRate, fraudRate, addressable, controlLoss, treatmentLoss])

  return (
    <div className="page lab-page">
      <PageIntro eyebrow="EVALUATION LAB" title={<>Prove lift before you <em>sell prevention.</em></>} description="A measurement workspace for sizing exposure, running randomized interventions, calibrating model thresholds, and separating confirmed outcomes from estimates." actions={<Badge tone="violet" icon={FlaskConical}>Illustrative assumptions</Badge>} />

      <section className="lab-banner"><Beaker aria-hidden="true" /><div><strong>This lab uses editable planning assumptions — not Redo production data.</strong><p>Results are a scenario model. Launch decisions require merchant-level denominators, holdout groups, confidence intervals, and confirmed outcome labels.</p></div></section>

      <div className="lab-grid">
        <section className="calculator-card">
          <header><div><Calculator aria-hidden="true" /><div><span className="eyebrow">ADDRESSABLE EXPOSURE</span><h2>Opportunity model</h2></div></div><Badge tone="neutral">ANNUALIZED</Badge></header>
          <div className="calculator-fields">
            <label><span>Merchant GMV scenario <button title="Gross merchandise value for the modeled cohort"><Info /></button></span><div className="input-affix"><i>$</i><input type="number" min="0" value={gmv} onChange={(event) => setGmv(Number(event.target.value))} /></div></label>
            <label><span>Return rate</span><div className="range-field"><input type="range" min="0" max="60" step="0.5" value={returnRate} onChange={(event) => setReturnRate(Number(event.target.value))} /><strong>{returnRate}%</strong></div></label>
            <label><span>Fraud loss rate within returns</span><div className="range-field"><input type="range" min="0" max="30" step="0.5" value={fraudRate} onChange={(event) => setFraudRate(Number(event.target.value))} /><strong>{fraudRate}%</strong></div></label>
            <label><span>Share addressable at this checkpoint</span><div className="range-field"><input type="range" min="0" max="100" step="1" value={addressable} onChange={(event) => setAddressable(Number(event.target.value))} /><strong>{addressable}%</strong></div></label>
          </div>
          <div className="calculation-chain">
            <span><small>Return GMV</small><strong>{money.format(result.returns)}</strong></span><ArrowRight /><span><small>Modeled fraud exposure</small><strong>{money.format(result.modeledLoss)}</strong></span><ArrowRight /><span className="highlight"><small>Addressable exposure</small><strong>{money.format(result.addressableLoss)}</strong></span>
          </div>
          <p className="formula-note"><strong>Formula:</strong> GMV × return rate × fraud-loss rate × addressable share. This sizes exposure; it does not prove prevention.</p>
        </section>

        <section className="experiment-card">
          <header><div><Users aria-hidden="true" /><div><span className="eyebrow">RANDOMIZED INTERVENTION</span><h2>Causal lift estimate</h2></div></div><Badge tone="blue">TREATMENT vs CONTROL</Badge></header>
          <div className="experiment-arms">
            <label className="experiment-arm"><span className="experiment-arm__label"><i className="control" />Control loss rate</span><div><input type="number" min="0" max="100" step="0.1" value={controlLoss} onChange={(event) => setControlLoss(Number(event.target.value))} /><b>%</b></div><small>Eligible shoppers see standard flow</small></label>
            <label className="experiment-arm"><span className="experiment-arm__label"><i className="treatment" />Treatment loss rate</span><div><input type="number" min="0" max="100" step="0.1" value={treatmentLoss} onChange={(event) => setTreatmentLoss(Number(event.target.value))} /><b>%</b></div><small>Eligible shoppers see proportional cure</small></label>
          </div>
          <div className="lift-result"><div><small>Illustrative relative lift</small><strong>{percent.format(result.causalRelativeLift)}</strong></div><span>×</span><div><small>Addressable exposure</small><strong>{money.format(result.addressableLoss)}</strong></div><span>=</span><div className="lift-result__answer"><small>Estimated deterrence</small><strong>{money.format(result.estimatedPrevented)}</strong></div></div>
          <div className="confidence-placeholder"><BarChart3 aria-hidden="true" /><div><strong>Significance is not computed in this fixture.</strong><span>Production reporting must include sample size, confidence interval, pre-registered primary outcome, and guardrails.</span></div></div>
        </section>
      </div>

      <section className="waterfall-section">
        <header>
          <div><span className="eyebrow">WORKED SEQUENTIAL EXAMPLE</span><h2>Credit each fraudulent dollar once.</h2><p>Hypothetical cohort: 1,000 orders × 20% returns × 10% fraud among returns = 20 attempted fraudulent returns. At $100 each, baseline exposure is $2,000. Rates below are demonstration inputs, not Redo performance claims.</p></div>
          <div className="waterfall-total"><small>Illustrative prevention</small><strong>13.93 cases</strong><span>$1,393 of $2,000 baseline</span></div>
        </header>
        <div className="waterfall-table" role="region" aria-label="Sequential fraud prevention example" tabIndex={0}>
          <table>
            <thead><tr><th>Decision family</th><th>Checkpoints</th><th>Cohort</th><th>Fraud entering</th><th>Eligible</th><th>Observable</th><th>Incrementally prevented</th><th>Residual</th></tr></thead>
            <tbody>{workedWaterfall.map((row) => <tr key={`${row.stage}-${row.cohort}`}><th><span>{row.stage}</span><i><b style={{ width: `${row.prevented / 4.21 * 100}%` }} /></i></th><td>{row.checkpoints}</td><td><Badge tone={row.cohort === 'Managed' ? 'orange' : row.cohort === 'Nonwarehouse' ? 'violet' : 'blue'}>{row.cohort}</Badge></td><td>{row.entering.toFixed(2)}</td><td>{row.eligible.toFixed(2)}</td><td>{row.observable.toFixed(2)}</td><td className="waterfall-prevented">{row.prevented.toFixed(2)} <small>· ${(row.prevented * 100).toFixed(0)}</small></td><td>{row.residual.toFixed(2)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="waterfall-notes"><span><Scale aria-hidden="true" /><strong>Sequential denominator:</strong> each stage receives only the residual from prior stages.</span><span><AlertCircle aria-hidden="true" /><strong>Not “flagged”:</strong> expected true cases depend on identity coverage, recall, action, and intervention success.</span><span><ShieldCheck aria-hidden="true" /><strong>Separate recovery:</strong> carrier, dispute, salvage, and protection belong in a different ledger.</span></div>
      </section>

      <section className="measurement-boundaries">
        <header><span className="eyebrow">MONEY MOVEMENT LEDGER</span><h2>Five numbers that must never blur together.</h2></header>
        <div className="boundary-grid">
          <article><span className="boundary-icon boundary-icon--green"><ShieldCheck /></span><strong>Verified loss stopped</strong><p>A confirmed fraudulent attempt where the intervention causally prevented payout or shipment.</p><Badge tone="green">CONFIRMED</Badge></article>
          <article><span className="boundary-icon boundary-icon--violet"><Gauge /></span><strong>Estimated deterrence</strong><p>Incremental reduction versus randomized control, reported with uncertainty.</p><Badge tone="violet">ESTIMATED</Badge></article>
          <article><span className="boundary-icon boundary-icon--orange"><AlertCircle /></span><strong>Unresolved exposure</strong><p>Open holds and uncertain outcomes. Never represented as savings.</p><Badge tone="orange">OPEN</Badge></article>
          <article><span className="boundary-icon boundary-icon--blue"><CircleDollarSign /></span><strong>Actual recovery</strong><p>Funds recovered through an authorized payment or carrier process.</p><Badge tone="blue">SETTLED</Badge></article>
          <article><span className="boundary-icon boundary-icon--red"><Users /></span><strong>Legitimate friction</strong><p>Good actors challenged, delayed, abandoned, or requiring support.</p><Badge tone="red">GUARDRAIL</Badge></article>
        </div>
      </section>

      <section className="cohort-section">
        <div className="cohort-copy"><span className="eyebrow">TWO COHORTS, ONE LEARNING LOOP</span><h2>Do not pretend broad signals have warehouse truth.</h2><p>The $80M managed-network target can produce controlled E4 inspection evidence that becomes E5 only after adjudication. The $200M broader scenario can use checkout, carrier, merchant-uploaded evidence, and confirmed payment outcomes — but must report source quality and denominators separately.</p></div>
        <div className="cohort-visual">
          <div className="cohort-ring cohort-ring--broad"><span><small>Broad cohort</small><strong>$200M</strong><em>Signals at 1–11, 14–15</em></span></div>
          <div className="cohort-ring cohort-ring--managed"><span><small>Managed target</small><strong>$80M</strong><em>E4 capture at 5, 12–13</em></span></div>
          <Badge tone="violet">PLANNING SCENARIO</Badge>
        </div>
      </section>

      <section className="threshold-section">
        <header><div><span className="eyebrow">SHADOW MODEL CALIBRATION</span><h2>Optimize dollars without hiding friction.</h2></div><Badge tone="neutral" icon={BrainCircuit}>No shopper impact in shadow mode</Badge></header>
        <div className="threshold-grid">
          <div className="confusion-matrix" aria-label="Illustrative confusion matrix">
            <span className="matrix-label matrix-label--top">Confirmed outcome</span><span className="matrix-label matrix-label--side">Model recommendation</span>
            <div className="matrix-cell matrix-cell--good"><small>True positive</small><strong>184</strong><span>Confirmed loss flagged</span></div>
            <div className="matrix-cell matrix-cell--bad"><small>False positive</small><strong>31</strong><span>Good actor flagged</span></div>
            <div className="matrix-cell matrix-cell--warn"><small>False negative</small><strong>47</strong><span>Confirmed loss missed</span></div>
            <div className="matrix-cell matrix-cell--neutral"><small>True negative</small><strong>1,462</strong><span>Good actor cleared</span></div>
          </div>
          <div className="threshold-controls">
            <label><span>Maximum legitimate challenge rate</span><div className="range-field"><input type="range" min="0" max="10" step="0.1" value={falsePositive} onChange={(event) => setFalsePositive(Number(event.target.value))} /><strong>{falsePositive}%</strong></div></label>
            <div className="guardrail-list"><span><Check /> ID challenge decline stays “unknown”</span><span><Check /> Technical failure measured separately</span><span><Check /> Conversion and support contacts monitored</span><span><Check /> Protected-class proxies audited</span><span><X /> No fraud label from challenge abandonment</span></div>
            <button className="button button--secondary"><SlidersHorizontal size={16} /> Save as shadow threshold</button>
          </div>
        </div>
      </section>
    </div>
  )
}
