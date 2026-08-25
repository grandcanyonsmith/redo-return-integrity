import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  Database,
  FileImage,
  FileText,
  Fingerprint,
  Image as ImageIcon,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MessageSquareText,
  PackageCheck,
  RotateCcw,
  ScanBarcode,
  Send,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
  Warehouse,
} from 'lucide-react'
import { useState, type ChangeEvent } from 'react'
import { Badge, PageIntro } from '../components/ui'
import {
  analyzeReturnContents,
  draftReturnCommunication,
  lookupReturnByLabel,
  queueTestCommunication,
  recordReturnReview,
  uploadIntakeEvidence,
  type CommunicationDraft,
  type CommunicationChannel,
  type IntakeFixtureId,
  type LabelLookupResult,
  type PackageInspection,
  type QueueResult,
} from '../lib/api'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const acceptedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

type IntakeImage = {
  previewUrl: string
  dataUrl?: string
  evidenceId?: string
  versionId?: string
  checksum?: string
  expiresAt?: string
  fixtureId?: IntakeFixtureId | 'labelRma8821'
  label: string
  synthetic: boolean
}

type PackageFixture = {
  id: IntakeFixtureId
  label: string
  shortLabel: string
  imageUrl: string
}

const labelFixture: IntakeImage = {
  previewUrl: '/evidence/return-label-rma-8821.png',
  fixtureId: 'labelRma8821',
  label: 'Synthetic UPS return label · RMA-8821',
  synthetic: true,
}

const defaultPackageImage: IntakeImage = {
  previewUrl: '/evidence/return-empty-box.png',
  fixtureId: 'emptyReturn',
  label: 'Opened parcel with no product',
  synthetic: true,
}

const packageFixtures: readonly PackageFixture[] = [
  { id: 'matchReturn', label: 'Expected SKU and quantity', shortLabel: 'Match', imageUrl: '/evidence/return-matching-contents.png' },
  { id: 'emptyReturn', label: 'Opened parcel with no product', shortLabel: 'Empty box', imageUrl: '/evidence/return-empty-box.png' },
  { id: 'quantityMismatch', label: 'One of two units returned', shortLabel: 'Qty mismatch', imageUrl: '/evidence/return-quantity-mismatch.png' },
  { id: 'wrongItem', label: 'Unrelated product in parcel', shortLabel: 'Wrong product', imageUrl: '/evidence/return-wrong-item.png' },
  { id: 'damagedProduct', label: 'Expected product with damage', shortLabel: 'Damaged', imageUrl: '/evidence/return-damaged-product.png' },
  { id: 'possibleImitation', label: 'Lookalike needing authentication', shortLabel: 'Possible imitation', imageUrl: '/evidence/return-imitation.png' },
]

const classificationFlags = [
  'EMPTY_BOX',
  'DAMAGED_PRODUCT',
  'QUANTITY_MISMATCH',
  'WRONG_PRODUCT',
  'POSSIBLE_IMITATION',
  'INCONCLUSIVE',
] as const

const moneyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const formatMoney = (cents: number | null | undefined) => cents === null || cents === undefined
  ? 'Not recommended'
  : moneyFormatter.format(cents / 100)

const formatToken = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (character) => character.toUpperCase())

const describeAuditMode = (mode: string) => mode === 'OPENAI'
  ? 'OpenAI response'
  : mode === 'SYNTHETIC_FIXTURE'
    ? 'Synthetic fixture'
    : 'Deterministic safe fallback'

const readAsDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onerror = () => reject(new Error('The browser could not read this image.'))
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('The selected file is not an image.'))
  reader.readAsDataURL(blob)
})

const prepareImage = async (file: File): Promise<string> => {
  if (!acceptedImageTypes.has(file.type)) throw new Error('Use a JPEG, PNG, or WebP image.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image must be 5 MB or smaller.')
  if (typeof createImageBitmap !== 'function') return readAsDataUrl(file)

  let bitmap: ImageBitmap | undefined
  try {
    bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) return readAsDataUrl(file)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const encoded = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    return encoded ? readAsDataUrl(encoded) : readAsDataUrl(file)
  } catch {
    return readAsDataUrl(file)
  } finally {
    bitmap?.close()
  }
}

type ExecutionMode = LabelLookupResult['executionMode'] | 'live' | 'fallback' | 'unavailable'

function ModeBadge({ mode }: { mode: ExecutionMode }) {
  if (mode === 'OPENAI') return <Badge tone="green" icon={CheckCircle2}>LIVE OPENAI RESULT</Badge>
  if (mode === 'DIRECT_IDENTIFIERS') return <Badge tone="blue" icon={Database}>DIRECT AWS LOOKUP</Badge>
  if (mode === 'live') return <Badge tone="green" icon={CheckCircle2}>LIVE TOOL RESULT</Badge>
  if (mode === 'SAFE_FALLBACK' || mode === 'unavailable') return <Badge tone="orange" icon={AlertCircle}>MODEL UNAVAILABLE</Badge>
  return <Badge tone="violet" icon={Sparkles}>SYNTHETIC FIXTURE</Badge>
}

function StepHeading({ number, title, description, complete }: { number: number; title: string; description: string; complete: boolean }) {
  return (
    <header className="intake-step__header">
      <span className={complete ? 'intake-step__number intake-step__number--complete' : 'intake-step__number'}>{complete ? <Check aria-hidden="true" /> : number}</span>
      <div><p className="eyebrow">STEP {number.toString().padStart(2, '0')}</p><h2>{title}</h2><p>{description}</p></div>
    </header>
  )
}

function CaptureCard({
  id,
  title,
  guidance,
  image,
  busy,
  onFile,
}: {
  id: string
  title: string
  guidance: string
  image: IntakeImage
  busy: boolean
  onFile: (file: File) => void
}) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) onFile(file)
    event.target.value = ''
  }

  return (
    <article className="intake-capture">
      <figure>
        <img src={image.previewUrl} alt={image.label} />
        <figcaption><Badge tone={image.synthetic ? 'violet' : image.evidenceId ? 'green' : 'blue'}>{image.synthetic ? 'SYNTHETIC TEST IMAGE' : image.evidenceId ? 'AWS-VERIFIED CAPTURE' : 'LOCAL CAPTURE'}</Badge><span>{image.label}</span></figcaption>
      </figure>
      <div className="intake-capture__controls">
        <div><strong>{title}</strong><p>{guidance}</p></div>
        <label className="button button--secondary" htmlFor={id} aria-disabled={busy}>
          {busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <Camera aria-hidden="true" />} {busy ? 'Verifying in AWS…' : 'Take or choose photo'}
          <input id={id} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy} onChange={handleChange} />
        </label>
      </div>
    </article>
  )
}

function LabelMatch({ lookup }: { lookup: LabelLookupResult }) {
  const { extraction, returnRecord } = lookup
  return (
    <div className="label-match">
      <header><div><Database aria-hidden="true" /><span><small>AWS LOOKUP RESULT</small><strong>Return record matched by {lookup.matchedBy.toLowerCase()}</strong></span></div><ModeBadge mode={lookup.executionMode} /></header>
      <div className="label-match__identifiers">
        <span><small>Extracted label ID</small><strong>{extraction.labelId ?? 'Not extracted'}</strong></span>
        <span><small>Extracted RMA</small><strong>{extraction.rmaId ?? 'Not extracted'}</strong></span>
        <span><small>Extracted order</small><strong>{extraction.orderId ?? 'Not extracted'}</strong></span>
        <span><small>Extracted carrier</small><strong>{extraction.carrier ?? 'Not extracted'}</strong></span>
        <span><small>Extracted tracking</small><strong>{extraction.trackingNumber ?? 'Not extracted'}</strong></span>
        <span><small>Extraction confidence</small><strong>{Math.round(extraction.confidence * 100)}%</strong></span>
      </div>
      {lookup.warnings.length > 0 ? <div className="label-match__warnings" role="status">{lookup.warnings.map((warning) => <span key={warning}><AlertCircle aria-hidden="true" />{warning}</span>)}</div> : null}
      <div className="return-record">
        <img src={returnRecord.product.imageUrl} alt={`Catalog reference for ${returnRecord.product.title}`} />
        <div className="return-record__copy"><Badge tone="blue">ORIGINAL PURCHASED SKU</Badge><h3>{returnRecord.product.title}</h3><p>{returnRecord.product.sku} · Qty {returnRecord.product.quantity} · {returnRecord.product.serials.join(' / ')}</p><span>{returnRecord.customer.name} · {returnRecord.customer.email}</span></div>
        <dl><div><dt>Requested</dt><dd>{formatMoney(returnRecord.return.requestedRefundCents)}</dd></div><div><dt>Eligible ceiling</dt><dd>{formatMoney(returnRecord.product.totalEligibleRefundCents)}</dd></div><div><dt>Status</dt><dd>{formatToken(returnRecord.return.status)}</dd></div></dl>
      </div>
      <section className="policy-snapshot" aria-label="Merchant policy snapshot">
        <header><ShieldCheck aria-hidden="true" /><div><small>MERCHANT POLICY SOURCE</small><strong>Versioned policy bound to this return</strong></div><Badge tone="blue">DETERMINISTIC INPUT</Badge></header>
        <dl>
          <div><dt>Policy ID</dt><dd>{returnRecord.return.policyId}</dd></div>
          <div><dt>Policy version</dt><dd>{returnRecord.return.policyVersion}</dd></div>
          <div><dt>Currency</dt><dd>{returnRecord.return.currency}</dd></div>
          <div className="policy-snapshot__hash"><dt>Snapshot SHA-256</dt><dd><code>{returnRecord.return.policySnapshotSha256}</code></dd></div>
        </dl>
        <p>Refund math is constrained by the explicit shopper request, eligible ceiling, currency, and this immutable policy snapshot. The model does not invent merchant policy.</p>
      </section>
    </div>
  )
}

function ModelAuditPanel({
  audit,
  mode,
  title,
}: {
  audit: PackageInspection['modelAudit']
  mode: string
  title: string
}) {
  return (
    <section className="model-audit" aria-label={title}>
      <header>
        <Fingerprint aria-hidden="true" />
        <div><small>MODEL EXECUTION AUDIT</small><strong>{title}</strong></div>
        <Badge tone={audit.provider === 'OPENAI' ? 'green' : audit.provider === 'SAFE_FALLBACK' ? 'orange' : 'violet'}>{describeAuditMode(mode).toUpperCase()}</Badge>
      </header>
      <dl>
        <div><dt>Provider</dt><dd>{audit.provider}</dd></div>
        <div><dt>Requested model</dt><dd>{audit.requestedModel}</dd></div>
        <div><dt>Provider model</dt><dd>{audit.providerModel ?? 'Not returned'}</dd></div>
        <div><dt>Request ID</dt><dd>{audit.requestId ?? 'Not returned'}</dd></div>
        <div><dt>Latency</dt><dd>{audit.latencyMs.toLocaleString()} ms</dd></div>
        <div><dt>Prompt version</dt><dd>{audit.promptVersion}</dd></div>
        <div><dt>Schema</dt><dd>{audit.schemaName}</dd></div>
        <div><dt>Provider storage</dt><dd>{audit.providerStorageRequested ? 'Requested' : 'Not requested · store: false'}</dd></div>
        <div className="model-audit__hash"><dt>Input SHA-256</dt><dd><code>{audit.inputSha256}</code></dd></div>
        <div className="model-audit__hash"><dt>Output SHA-256</dt><dd><code>{audit.outputSha256 ?? 'No provider output persisted'}</code></dd></div>
      </dl>
      <p>These are request and response audit fields—not an API key, credential, or verified operator identity.</p>
    </section>
  )
}

function ComparisonValue({ value }: { value: boolean | null }) {
  if (value === null) return <span className="comparison-value comparison-value--neutral">Not established</span>
  return value
    ? <span className="comparison-value comparison-value--pass"><CheckCircle2 aria-hidden="true" /> Match</span>
    : <span className="comparison-value comparison-value--concern"><AlertCircle aria-hidden="true" /> Mismatch</span>
}

function EvidenceImage({ imageUrl, title, provenance }: { imageUrl: string; title: string; provenance: string }) {
  return (
    <figure className="provenance-image">
      <img src={imageUrl} alt={title} />
      <figcaption><strong>{title}</strong><span><Fingerprint aria-hidden="true" /> {provenance}</span></figcaption>
    </figure>
  )
}

function InspectionOutput({
  inspection,
  executionMode,
  expectedSku,
  originalImageUrl,
  warehouseImageUrl,
  warehouseProvenance,
  rawVisible,
  onToggleRaw,
}: {
  inspection: PackageInspection
  executionMode: ExecutionMode
  expectedSku: string
  originalImageUrl: string
  warehouseImageUrl: string
  warehouseProvenance: string
  rawVisible: boolean
  onToggleRaw: () => void
}) {
  const observed = inspection.observedItems[0]
  const missingQuantity = Math.max(0, inspection.comparison.expectedQuantity - inspection.comparison.observedQuantity)
  const quarantineRecommended = ['EMPTY_BOX', 'WRONG_PRODUCT', 'POSSIBLE_IMITATION', 'INCONCLUSIVE'].includes(inspection.classification)
  return (
    <div className="inspection-output">
      <header className="inspection-output__header">
        <div><span className="eyebrow">SCHEMA-VALIDATED OUTPUT</span><h2>{formatToken(inspection.classification)}</h2><p>{inspection.summary}</p></div>
        <div className="inspection-output__meta"><ModeBadge mode={executionMode} /><strong>{Math.round(inspection.confidence * 100)}% confidence</strong><small>{inspection.modelVersion} · recommendation only</small></div>
      </header>

      <div className="evidence-pair">
        <EvidenceImage imageUrl={originalImageUrl} title="Original purchased SKU" provenance="Merchant catalog source" />
        <EvidenceImage imageUrl={warehouseImageUrl} title="Warehouse evidence" provenance={warehouseProvenance} />
      </div>

      <ModelAuditPanel audit={inspection.modelAudit} mode={inspection.analysisMode} title="Inspection request and response" />

      <div className="inspection-columns">
        <section className="structured-card">
          <header><PackageCheck aria-hidden="true" /><div><small>EXPECTED VS OBSERVED</small><strong>Item comparison</strong></div></header>
          <div className="comparison-table" role="table" aria-label="Expected versus observed return contents">
            <div role="row" className="comparison-table__head"><span role="columnheader">Field</span><span role="columnheader">Expected</span><span role="columnheader">Observed</span></div>
            <div role="row"><strong role="rowheader">SKU</strong><span role="cell">{expectedSku}</span><span role="cell">{observed?.candidateSku ?? 'None visible'}</span></div>
            <div role="row"><strong role="rowheader">Quantity</strong><span role="cell">{inspection.comparison.expectedQuantity}</span><span role="cell">{inspection.comparison.observedQuantity}</span></div>
            <div role="row"><strong role="rowheader">Condition</strong><span role="cell">Return-policy eligible</span><span role="cell">{observed?.condition ?? 'Not assessable'}</span></div>
            <div role="row"><strong role="rowheader">SKU result</strong><span role="cell" className="comparison-table__span"><ComparisonValue value={inspection.comparison.skuMatch} /></span></div>
            <div role="row"><strong role="rowheader">Quantity result</strong><span role="cell" className="comparison-table__span"><ComparisonValue value={inspection.comparison.quantityMatch} /></span></div>
            <div role="row"><strong role="rowheader">Serial result</strong><span role="cell" className="comparison-table__span"><ComparisonValue value={inspection.comparison.serialMatch} /></span></div>
          </div>
        </section>

        <section className="structured-card">
          <header><Warehouse aria-hidden="true" /><div><small>NATIVE OPERATOR FACTS</small><strong>Warehouse disposition inputs</strong></div></header>
          <div className="native-fact-grid">
            <span><small>Missing</small><strong>{missingQuantity > 0 ? `${missingQuantity} item${missingQuantity === 1 ? '' : 's'}` : 'None observed'}</strong></span>
            <span><small>Process</small><strong>Open-box verification</strong></span>
            <span><small>Undeclared item</small><strong>{inspection.classification === 'WRONG_PRODUCT' ? observed?.description ?? 'Present' : 'None recorded'}</strong></span>
            <span><small>Quarantine</small><strong>{quarantineRecommended ? 'Recommended' : 'Not recommended'}</strong></span>
          </div>
          <div className="ai-label-heading"><Bot aria-hidden="true" /><span><small>OPENAI RECOMMENDATION · SEPARATE FROM OPERATOR FACTS</small><strong>Bounded classification variables</strong></span></div>
          <div className="classification-grid">
            {classificationFlags.map((flag) => <span key={flag} className={inspection.classification === flag ? 'classification-flag classification-flag--active' : 'classification-flag'}><i>{inspection.classification === flag ? <Check aria-hidden="true" /> : null}</i>{formatToken(flag)}</span>)}
          </div>
          <div className="next-action"><small>NEXT ACTION RECOMMENDATION</small><strong>{formatToken(inspection.nextAction)}</strong><span>No action executes without an authorized human.</span></div>
          {inspection.missingEvidence.length > 0 ? <div className="missing-evidence"><strong>Missing evidence</strong><ul>{inspection.missingEvidence.map((item) => <li key={item}>{item}</li>)}</ul></div> : <div className="evidence-complete"><CheckCircle2 aria-hidden="true" /><span>Required comparison evidence is present.</span></div>}
        </section>
      </div>

      <button className="raw-toggle" type="button" onClick={onToggleRaw} aria-expanded={rawVisible}><Code2 aria-hidden="true" /> {rawVisible ? 'Hide raw JSON' : 'View raw JSON'}</button>
      {rawVisible ? <pre className="raw-output" aria-label="Raw structured inspection JSON">{JSON.stringify(inspection, null, 2)}</pre> : null}
    </div>
  )
}

function RefundRecommendation({ inspection }: { inspection: PackageInspection }) {
  return (
    <section className="refund-review__recommendation">
      <header><ShieldCheck aria-hidden="true" /><div><small>POLICY-CONSTRAINED RECOMMENDATION</small><h3>{formatToken(inspection.refund.recommendedType)}</h3></div><Badge tone="blue">HUMAN REQUIRED</Badge></header>
      <div className="refund-amounts"><span><small>Recommended refund</small><strong>{formatMoney(inspection.refund.recommendedAmountCents)}</strong></span><span><small>Temporary withhold</small><strong>{formatMoney(inspection.refund.withholdAmountCents)}</strong></span></div>
      <p>{inspection.refund.rationale}</p>
    </section>
  )
}

function HumanReview({
  inspection,
  draft,
  approved,
  reviewerLabel,
  onApproved,
  onReviewerLabel,
  reviewMutation,
  queueMutation,
}: {
  inspection: PackageInspection
  draft?: CommunicationDraft
  approved: boolean
  reviewerLabel: string
  onApproved: (approved: boolean) => void
  onReviewerLabel: (label: string) => void
  reviewMutation: UseMutationResult<Awaited<ReturnType<typeof recordReturnReview>>, Error, void>
  queueMutation: UseMutationResult<QueueResult, Error, { draftId: string; reviewId: string }>
}) {
  const review = reviewMutation.data
  const draftId = draft?.draftId
  return (
    <section className="refund-review__human">
      <span className="human-avatar">OP</span>
      <div>
        <span className="eyebrow">SERVER-RECORDED MERCHANT REVIEW</span><h3>Review the evidence, recommendation, and draft</h3><p>The model cannot move funds, deny a return, or contact a shopper. This prototype records a session-scoped review citing all {inspection.evidenceIds.length} inspection evidence reference{inspection.evidenceIds.length === 1 ? '' : 's'} before it permits even a delivery-disabled queue event.</p>
        <label className="reviewer-label"><span>Reviewer display label</span><input value={reviewerLabel} disabled={Boolean(review)} onChange={(event) => onReviewerLabel(event.target.value)} maxLength={100} /></label>
        <div className="identity-boundary" role="note"><ShieldAlert aria-hidden="true" /><span><strong>Unauthenticated display label only</strong>This demo field is not a login, role check, employee identity, or authorization claim. Production requires Redo SSO, tenant binding, and RBAC.</span></div>
        <div className="review-binding" role="group" aria-label="Approve as written draft binding">
          <small>EXACT DRAFT BINDING</small><strong>APPROVE_AS_WRITTEN</strong>
          <span>Draft content SHA-256</span><code>{draft?.contentSha256 ?? 'Generate the message preview to establish the draft digest.'}</code>
          <p>The server stores this decision and digest together, then rejects queueing if the draft content no longer matches.</p>
        </div>
        <label className="checkbox-label checkbox-label--boxed"><input type="checkbox" checked={approved} disabled={Boolean(review)} onChange={(event) => onApproved(event.target.checked)} /><span>I reviewed the source images, structured findings, refund math, missing evidence, merchant policy, and shopper communication draft. I approve the exact draft digest above as written (<code>APPROVE_AS_WRITTEN</code>) and accept responsibility for the next test-only step.</span></label>
        <button className="button button--primary" disabled={!approved || !draftId || reviewerLabel.trim().length < 2 || reviewMutation.isPending || Boolean(review)} onClick={() => reviewMutation.mutate()}>{reviewMutation.isPending ? <LoaderCircle className="spin" aria-hidden="true" /> : <UserCheck aria-hidden="true" />} {review ? 'Review persisted · no funds moved' : !draftId ? 'Generate the message preview first' : 'Persist human review'}</button>
        {reviewMutation.isError ? <p className="intake-error" role="alert"><AlertCircle aria-hidden="true" /> The review was not persisted. Queueing remains locked.</p> : null}
        {review ? <div className="persisted-review" role="status"><CheckCircle2 aria-hidden="true" /><span><strong>Review {review.reviewId}</strong><small>Display label: {review.reviewerLabel} · {review.reviewerIdentityAssurance.replaceAll('_', ' ').toLowerCase()}</small><small>Decision: {review.draftDecision} · {new Date(review.reviewedAt).toLocaleString()}</small><code>Draft SHA-256: {review.draftContentSha256}</code></span></div> : null}
        <div className="message-preview__actions"><button className="button button--primary" disabled={!review || queueMutation.isPending || queueMutation.data?.status === 'QUEUED_TEST_OUTBOX'} onClick={() => review && queueMutation.mutate({ draftId: review.draftId, reviewId: review.reviewId })}>{queueMutation.isPending ? <LoaderCircle className="spin" aria-hidden="true" /> : <Send aria-hidden="true" />} {queueMutation.data?.status === 'QUEUED_TEST_OUTBOX' ? 'Queued in test outbox' : 'Queue test shopper message'}</button><small>{review ? 'No production delivery adapter is enabled.' : 'Persist the human review to unlock the controlled test outbox.'}</small></div>
        {queueMutation.data ? <p className={queueMutation.data.status === 'QUEUED_TEST_OUTBOX' ? 'queue-status queue-status--success' : 'queue-status'} role="status"><Send aria-hidden="true" /> {queueMutation.data.message}</p> : null}
      </div>
    </section>
  )
}

function CommunicationPreview({
  inspection,
  channel,
  onChannel,
  draftMutation,
  customerPhone,
}: {
  inspection: PackageInspection
  channel: CommunicationChannel
  onChannel: (channel: CommunicationChannel) => void
  draftMutation: UseMutationResult<Awaited<ReturnType<typeof draftReturnCommunication>>, Error, void>
  customerPhone?: string | null
}) {
  if (!inspection.communication.recommended) {
    return <section className="communication-panel communication-panel--quiet"><MessageSquareText aria-hidden="true" /><div><strong>No shopper communication recommended</strong><p>The structured response did not request an email or text.</p></div></section>
  }
  const draft = draftMutation.data?.draft
  const originalAttachment = draft?.attachments.find((attachment) => attachment.role === 'ORIGINAL_PRODUCT_REFERENCE')
  const warehouseAttachment = draft?.attachments.find((attachment) => attachment.role === 'WAREHOUSE_EVIDENCE')
  return (
    <section className="communication-panel">
      <header><div><MessageSquareText aria-hidden="true" /><span><small>COMMUNICATION RECOMMENDATION</small><h3>{formatToken(inspection.communication.templateIntent)}</h3></span></div>{draftMutation.data ? <ModeBadge mode={draftMutation.data.executionMode} /> : <Badge tone="neutral">NOT DRAFTED</Badge>}</header>
      <p>Generate a customer-safe draft from the matched order, customer profile, policy result, catalog image, and warehouse evidence. This demo queues only to a controlled test outbox.</p>
      <div className="channel-picker" role="radiogroup" aria-label="Communication channel">
        <label className={channel === 'EMAIL' ? 'active' : ''}><input type="radio" name="intake-channel" value="EMAIL" checked={channel === 'EMAIL'} onChange={() => onChannel('EMAIL')} /><Mail aria-hidden="true" /> Email</label>
        <label className={channel === 'SMS' ? 'active' : ''} aria-disabled={!customerPhone}><input type="radio" name="intake-channel" value="SMS" checked={channel === 'SMS'} disabled={!customerPhone} onChange={() => onChannel('SMS')} /><Smartphone aria-hidden="true" /> Text {!customerPhone ? '(no phone)' : ''}</label>
      </div>
      {!draft ? <button className="button button--secondary" disabled={draftMutation.isPending} onClick={() => draftMutation.mutate()}>{draftMutation.isPending ? <LoaderCircle className="spin" aria-hidden="true" /> : <Bot aria-hidden="true" />} {draftMutation.isPending ? 'Drafting…' : `Generate ${channel.toLowerCase()} preview`}</button> : (
        <article className="message-preview">
          <header><span><strong>{draft.channel === 'EMAIL' ? 'Email preview' : 'Text preview'}</strong><small>To: {draft.recipient}</small></span><Badge tone="violet">TEST ONLY</Badge></header>
          {draft.subject ? <div className="message-preview__subject"><small>SUBJECT</small><strong>{draft.subject}</strong></div> : null}
          <div className="message-preview__body">{draft.body}</div>
          <div className="message-preview__evidence">
            <EvidenceImage imageUrl={draft.originalProductImageUrl} title="Purchased SKU reference" provenance={originalAttachment?.provenance ?? 'Merchant catalog attachment'} />
            {draft.warehouseEvidenceImageUrl
              ? <EvidenceImage imageUrl={draft.warehouseEvidenceImageUrl} title="Warehouse provenance" provenance={`${warehouseAttachment?.provenance ?? 'Inspection attachment'}${warehouseAttachment?.evidenceId ? ` · ${warehouseAttachment.evidenceId}` : ''}`} />
              : <div className="provenance-missing"><AlertCircle aria-hidden="true" /><strong>Warehouse image unavailable</strong><span>The draft can be reviewed, but the evidence image must be attached before any production communication.</span></div>}
          </div>
          <div className="draft-integrity"><Fingerprint aria-hidden="true" /><div><small>EXACT DRAFT CONTENT DIGEST</small><strong>SHA-256 bound at human review</strong><code>{draft.contentSha256}</code><p>Any subject or body change creates a different digest and requires a new review.</p></div></div>
          <ModelAuditPanel audit={draft.modelAudit} mode={draft.generationMode ?? draft.modelAudit.provider} title="Shopper-message draft request and response" />
        </article>
      )}
      {draftMutation.isError ? <p className="intake-error" role="alert"><AlertCircle aria-hidden="true" /> Draft generation is unavailable. Nothing was sent.</p> : null}
    </section>
  )
}

export function IntakePage() {
  const [labelImage, setLabelImage] = useState<IntakeImage>(labelFixture)
  const [packageImage, setPackageImage] = useState<IntakeImage>(defaultPackageImage)
  const [preparing, setPreparing] = useState<'label' | 'package' | null>(null)
  const [fileError, setFileError] = useState('')
  const [rawVisible, setRawVisible] = useState(false)
  const [humanApproved, setHumanApproved] = useState(false)
  const [reviewerLabel, setReviewerLabel] = useState('DEN-04 demo operator')
  const [channel, setChannel] = useState<CommunicationChannel>('EMAIL')
  const [scanValue, setScanValue] = useState('')

  const labelLookup = useMutation({
    mutationFn: () => {
      const manualIdentifier = scanValue.trim()
      if (manualIdentifier) return lookupReturnByLabel({ scanValue: manualIdentifier })
      if (labelImage.fixtureId === 'labelRma8821') return lookupReturnByLabel({ fixtureId: 'labelRma8821' })
      if (labelImage.evidenceId) return lookupReturnByLabel({ evidenceId: labelImage.evidenceId })
      throw new Error('Choose a verified label photo or enter a return identifier.')
    },
  })
  const inspection = useMutation({
    mutationFn: () => {
      const returnRecordId = labelLookup.data?.returnRecord.returnRecordId
      if (!returnRecordId) throw new Error('Match the return label before inspecting the contents.')
      return analyzeReturnContents({
        returnRecordId,
        fixtureId: packageImage.fixtureId === 'labelRma8821' ? undefined : packageImage.fixtureId,
        evidenceId: packageImage.evidenceId,
      })
    },
  })
  const draftMutation = useMutation({
    mutationFn: () => {
      const inspectionId = inspection.data?.inspection.inspectionId
      if (!inspectionId) throw new Error('Run the inspection before drafting a message.')
      return draftReturnCommunication({ inspectionId, channel })
    },
  })
  const reviewMutation = useMutation({
    mutationFn: () => {
      const inspectionRecord = inspection.data?.inspection
      const draft = draftMutation.data?.draft
      if (!inspectionRecord || !draft) throw new Error('Create an inspection and shopper-message draft before recording review.')
      return recordReturnReview({
        inspectionId: inspectionRecord.inspectionId,
        draftId: draft.draftId,
        reviewerLabel: reviewerLabel.trim(),
        evidenceIds: inspectionRecord.evidenceIds,
      })
    },
  })
  const queueMutation = useMutation({ mutationFn: (input: { draftId: string; reviewId: string }) => queueTestCommunication(input) })

  const clearAfterLabel = () => {
    labelLookup.reset()
    inspection.reset()
    draftMutation.reset()
    queueMutation.reset()
    reviewMutation.reset()
    setHumanApproved(false)
    setRawVisible(false)
    setPackageImage(defaultPackageImage)
  }

  const clearAfterPackage = () => {
    inspection.reset()
    draftMutation.reset()
    queueMutation.reset()
    reviewMutation.reset()
    setHumanApproved(false)
    setRawVisible(false)
  }

  const selectLocalImage = async (file: File, kind: 'label' | 'package') => {
    setFileError('')
    setPreparing(kind)
    try {
      const dataUrl = await prepareImage(file)
      const upload = await uploadIntakeEvidence(dataUrl, kind === 'label' ? 'RETURN_LABEL' : 'PACKAGE_CONTENTS')
      const selected: IntakeImage = {
        previewUrl: dataUrl,
        dataUrl,
        evidenceId: upload.evidenceId,
        versionId: upload.versionId,
        checksum: upload.sha256,
        expiresAt: upload.expiresAt,
        label: `${file.name} · completed AWS evidence`,
        synthetic: false,
      }
      if (kind === 'label') {
        setScanValue('')
        setLabelImage(selected)
        clearAfterLabel()
      } else {
        setPackageImage(selected)
        clearAfterPackage()
      }
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Image preparation failed.')
    } finally {
      setPreparing(null)
    }
  }

  const selectPackageFixture = (fixture: PackageFixture) => {
    setPackageImage({ previewUrl: fixture.imageUrl, fixtureId: fixture.id, label: fixture.label, synthetic: true })
    clearAfterPackage()
  }

  const resetTestLabel = () => {
    setScanValue('')
    setLabelImage(labelFixture)
    clearAfterLabel()
  }

  const changeChannel = (nextChannel: CommunicationChannel) => {
    setChannel(nextChannel)
    draftMutation.reset()
    queueMutation.reset()
    reviewMutation.reset()
    setHumanApproved(false)
  }

  const decisionRecorded = Boolean(reviewMutation.data)
  const completedSteps = labelLookup.data ? inspection.data ? decisionRecorded ? 4 : 3 : 2 : 0
  const returnRecord = labelLookup.data?.returnRecord
  const result = inspection.data
  const warehouseImageUrl = result?.inspection.warehouseEvidenceImageUrl ?? packageImage.previewUrl
  const warehouseProvenance = packageImage.evidenceId
    ? `Completed immutable S3 evidence · ${packageImage.evidenceId} · version ${packageImage.versionId?.slice(0, 12) ?? 'verified'}… · SHA-256 ${packageImage.checksum?.slice(0, 12) ?? 'verified'}…`
    : `Synthetic fixture · ${packageImage.fixtureId ?? 'local preview'}`
  const labelSourceMode = scanValue.trim()
    ? 'DIRECT IDENTIFIER · the photo will not be analyzed'
    : labelImage.evidenceId
      ? 'VERIFIED PHOTO · OpenAI extraction then AWS lookup'
      : 'SYNTHETIC FIXTURE · deterministic tool result'

  return (
    <div className="page intake-page">
      <PageIntro
        eyebrow="MERCHANT + WAREHOUSE WORKFLOW · JUNIPER CIRCUIT"
        title={<>Scan the return. <em>Inspect what arrived.</em></>}
        description="A guided intake station turns a label, order record, catalog image, and package photo into structured findings. OpenAI tools describe and recommend; deterministic merchant policy and an accountable human control the outcome."
        actions={<Badge tone="orange" icon={Warehouse}>Station DEN-04 · Test mode</Badge>}
      />

      <div className="intake-safety"><LockKeyhole aria-hidden="true" /><div><strong>Synthetic data is selected by default.</strong><p>Use only test labels and test customer data. Camera images are re-encoded, checksum-verified in ephemeral S3 storage, and scheduled to expire after 24 hours. Production messaging is disabled; the final control writes only to a test outbox.</p></div><Badge tone="violet">NO REAL CUSTOMER SENDS</Badge></div>

      <ol className="intake-progress" aria-label="Return intake progress">
        {['Scan label', 'Match order', 'Inspect contents', 'Review + communicate'].map((step, index) => <li key={step} aria-current={completedSteps === index ? 'step' : undefined} className={completedSteps > index ? 'complete' : completedSteps === index ? 'active' : ''}><span>{completedSteps > index ? <Check aria-hidden="true" /> : index + 1}</span><strong>{step}</strong></li>)}
      </ol>

      <p className="sr-only" role="status" aria-live="polite">Return intake is at step {Math.min(completedSteps + 1, 4)} of 4.</p>

      {fileError ? <p className="intake-error" role="alert"><AlertCircle aria-hidden="true" /> {fileError}</p> : null}

      <section className="intake-step">
        <StepHeading number={1} title="Scan Return" description="Scan a return label, enter an RMA or license plate, and resolve the parcel before it is opened." complete={Boolean(labelLookup.data)} />
        <div className="intake-step__grid">
          <CaptureCard id="return-label-photo" title="Return label image" guidance="Center the barcode and all return identifiers. Avoid fingers, glare, and cropped edges." image={labelImage} busy={preparing === 'label'} onFile={(file) => void selectLocalImage(file, 'label')} />
          <div className="intake-tool-call">
            <header><ScanBarcode aria-hidden="true" /><div><small>MCP TOOL 01</small><h3>lookup_return_by_label</h3></div></header>
            <p>Choose one source: leave the field blank to read the selected photo, or enter a scanned identifier for a direct database lookup. The server validates tool output before querying the isolated AWS return-record table.</p>
            <label className="scan-entry"><span><ScanBarcode aria-hidden="true" /></span><input value={scanValue} onChange={(event) => { setScanValue(event.target.value); clearAfterLabel() }} placeholder="Optional direct RMA, tracking, order, or label ID" aria-label="Optional direct RMA, tracking, order, or label ID" /></label>
            <p className="intake-source-mode"><Fingerprint aria-hidden="true" />{labelSourceMode}</p>
            <ul><li>Tracking number</li><li>RMA + order ID</li><li>Carrier</li><li>Extraction confidence</li></ul>
            <div className="intake-tool-call__actions"><button className="button button--primary" disabled={labelLookup.isPending || preparing === 'label'} onClick={() => labelLookup.mutate()}>{labelLookup.isPending ? <LoaderCircle className="spin" aria-hidden="true" /> : <Database aria-hidden="true" />} {labelLookup.isPending ? 'Reading + looking up…' : scanValue.trim() ? 'Look up identifier in AWS' : labelImage.evidenceId ? 'Read photo with OpenAI' : 'Run synthetic label tool'}</button>{!labelImage.synthetic ? <button className="button button--secondary button--small" onClick={resetTestLabel}><RotateCcw aria-hidden="true" /> Use test label</button> : null}</div>
            {labelLookup.isError ? <p className="intake-error" role="alert"><AlertCircle aria-hidden="true" /> The live lookup could not safely match this image. Try the synthetic test label or check the API.</p> : null}
          </div>
        </div>
      </section>

      {labelLookup.data ? (
        <section className="intake-step">
          <StepHeading number={2} title="Confirm the matched return" description="The photo does not become the source of truth; it resolves to a database record that supplies the expected SKU, quantity, shopper, and policy." complete />
          <LabelMatch lookup={labelLookup.data} />
        </section>
      ) : null}

      <section className={returnRecord ? 'intake-step' : 'intake-step intake-step--locked'} aria-disabled={!returnRecord}>
        <StepHeading number={3} title="Photograph the opened package" description="Capture the full contents after the label match. The model compares visible contents with the expected product record and catalog image." complete={Boolean(result)} />
        {!returnRecord ? <div className="locked-notice"><LockKeyhole aria-hidden="true" /><span><strong>Label match required</strong>Complete step 1 before package analysis can run.</span></div> : (
          <>
            <div className="fixture-selector" role="group" aria-label="Synthetic package examples"><span><FileImage aria-hidden="true" /> Load a synthetic test case</span><div>{packageFixtures.map((fixture) => <button key={fixture.id} aria-pressed={packageImage.fixtureId === fixture.id} className={packageImage.fixtureId === fixture.id ? 'active' : ''} onClick={() => selectPackageFixture(fixture)}><img src={fixture.imageUrl} alt="" /><span>{fixture.shortLabel}</span></button>)}</div></div>
            <div className="intake-step__grid">
              <CaptureCard id="package-contents-photo" title="Opened-package contents" guidance="Include the full box, every item, packaging, labels, serial markings, and visible damage in the frame." image={packageImage} busy={preparing === 'package'} onFile={(file) => void selectLocalImage(file, 'package')} />
              <div className="intake-tool-call intake-tool-call--vision">
                <header><Bot aria-hidden="true" /><div><small>MCP TOOL 02</small><h3>analyze_return_contents</h3></div></header>
                <p>A multimodal, strict-schema comparison produces observations and bounded flags. It cannot prove intent, identity, or counterfeit status.</p>
                <div className="tool-schema"><span><ImageIcon aria-hidden="true" /> Visible items + condition</span><span><PackageCheck aria-hidden="true" /> SKU + quantity comparison</span><span><ShieldAlert aria-hidden="true" /> Bounded discrepancy flags</span><span><FileText aria-hidden="true" /> Refund + next-action recommendation</span></div>
                <button className="button button--primary" disabled={inspection.isPending || preparing === 'package'} onClick={() => inspection.mutate()}>{inspection.isPending ? <LoaderCircle className="spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />} {inspection.isPending ? 'Analyzing structured evidence…' : 'Analyze contents against order'}</button>
                {inspection.isError ? <p className="intake-error" role="alert"><AlertCircle aria-hidden="true" /> The image could not be analyzed safely. No classification or refund action was recorded.</p> : null}
              </div>
            </div>
          </>
        )}
      </section>

      {result && returnRecord ? (
        <section className="intake-step intake-step--result">
          <StepHeading number={4} title="Review the recommendation and shopper message" description="Keep model output, merchant policy, human accountability, and communication delivery as separate recorded steps." complete={decisionRecorded} />
          <InspectionOutput inspection={result.inspection} executionMode={result.executionMode} expectedSku={returnRecord.product.sku} originalImageUrl={returnRecord.product.imageUrl} warehouseImageUrl={warehouseImageUrl} warehouseProvenance={warehouseProvenance} rawVisible={rawVisible} onToggleRaw={() => setRawVisible((visible) => !visible)} />
          <RefundRecommendation inspection={result.inspection} />
          <CommunicationPreview inspection={result.inspection} channel={channel} onChannel={changeChannel} draftMutation={draftMutation} customerPhone={returnRecord.customer.phone} />
          <HumanReview inspection={result.inspection} draft={draftMutation.data?.draft} approved={humanApproved} reviewerLabel={reviewerLabel} onReviewerLabel={setReviewerLabel} onApproved={(approved) => { setHumanApproved(approved); if (!approved) reviewMutation.reset() }} reviewMutation={reviewMutation} queueMutation={queueMutation} />
          <div className="intake-audit-note"><ClipboardCheck aria-hidden="true" /><div><strong>Audit boundary</strong><p>Label lookup, image assessment, policy recommendation, human review, and test-outbox queue are distinct events. A queue receipt does not mean an email was delivered, a refund moved, or a payment dispute was filed.</p></div><ArrowRight aria-hidden="true" /></div>
        </section>
      ) : null}
    </div>
  )
}
