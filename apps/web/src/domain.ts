export type EvidenceTier = 'E0' | 'E1' | 'E2' | 'E3' | 'E4' | 'E5'

export type DecisionStep = {
  title: string
  detail: string
  tone?: 'neutral' | 'good' | 'warn' | 'danger' | 'ai'
}

export type Checkpoint = {
  id: string
  number: number
  phase: 'Purchase' | 'Fulfillment' | 'Return' | 'Resolution'
  label: string
  decision: string
  coverage: 'All GMV' | 'Managed network' | 'Merchant integrated'
  evidenceTier: EvidenceTier
  facts: DecisionStep
  signals: DecisionStep
  assessment: DecisionStep
  policy: DecisionStep
  action: DecisionStep
  cure: DecisionStep
  next: DecisionStep
}

const checkpoint = (
  number: number,
  id: string,
  phase: Checkpoint['phase'],
  label: string,
  decision: string,
  coverage: Checkpoint['coverage'],
  evidenceTier: EvidenceTier,
  values: string[],
): Checkpoint => ({
  number,
  id,
  phase,
  label,
  decision,
  coverage,
  evidenceTier,
  facts: { title: 'Native facts', detail: values[0], tone: 'neutral' },
  signals: { title: 'Deterministic signals', detail: values[1], tone: values[1].includes('No ') ? 'good' : 'warn' },
  assessment: { title: 'OpenAI assessment', detail: values[2], tone: 'ai' },
  policy: { title: 'Merchant policy', detail: values[3], tone: 'neutral' },
  action: { title: 'Accountable action', detail: values[4], tone: values[4].includes('hold') || values[4].includes('review') ? 'warn' : 'good' },
  cure: { title: 'Shopper cure', detail: values[5], tone: 'good' },
  next: { title: 'Next state', detail: values[6], tone: 'neutral' },
})

export const checkpoints: Checkpoint[] = [
  checkpoint(1, 'VISIT_SESSION', 'Purchase', 'Visit & session', 'Allow, monitor, or challenge the session?', 'All GMV', 'E1', [
    'Session ID, timestamps, consented device signals, IP region, landing source, navigation events.',
    'Velocity, impossible travel, automation cadence, proxy mismatch. No biometric identity inference.',
    'Pattern summary and uncertainty; content is untrusted evidence, never an instruction.',
    'Low-risk sessions pass. Elevated automation requires a reversible bot challenge.',
    'Pass monitored — no purchase restriction.',
    'Complete an accessible bot challenge or continue through assisted support.',
    'Identity link',
  ]),
  checkpoint(2, 'IDENTITY_LINK', 'Purchase', 'Identity link', 'Can this visit be safely linked to known history?', 'All GMV', 'E2', [
    'Hashed email/phone, account tenure, consented device token, address normalization, prior orders and disputes.',
    'Exact and fuzzy link strengths are recorded separately; shared households never equal fraud.',
    'Explains which history may be relevant and explicitly abstains when identity is ambiguous.',
    'A link may raise verification, but cannot itself deny a purchase.',
    'Challenge only when policy threshold and expected order exposure justify friction.',
    'Verify email/phone, use another payment method, or submit identity through an approved vendor.',
    'Checkout & payment',
  ]),
  checkpoint(3, 'CHECKOUT_PAYMENT', 'Purchase', 'Checkout & payment', 'Authorize, step up, or route to review?', 'All GMV', 'E2', [
    'Cart, value, SKU risk, AVS/CVV/3DS results, tokenized payment metadata, billing/shipping consistency.',
    'Payment mismatch, retry velocity, first-order exposure, reshipper address, prior confirmed-loss linkage.',
    'Recommends pass, monitored pass, or proportionate challenge with reasons and counter-evidence.',
    'No model can auto-deny. High confidence triggers a choice of low-friction verification paths.',
    'Challenge: verify email plus payment possession. Checkout remains recoverable.',
    'Use 3DS, verified phone, alternative payment, or approved ID provider. Declining is not proof of fraud.',
    'Order release',
  ]),
  checkpoint(4, 'ORDER_RELEASE', 'Purchase', 'Order release', 'Release, hold briefly, or review before fulfillment?', 'All GMV', 'E2', [
    'Authorization result, challenge outcome, inventory, fulfillment cutoff, shopper response, policy version.',
    'Challenge completed, abandoned, failed technically, or timed out — each is a distinct event.',
    'Summarizes residual exposure; noncompletion remains unknown, not fraudulent.',
    'Release verified good actors; route unresolved high-dollar exposure to an accountable human.',
    'Release order after successful alternative verification.',
    'Contact support to correct data or choose another verification route before hold expiry.',
    'Outbound pack',
  ]),
  checkpoint(5, 'OUTBOUND_PACK', 'Fulfillment', 'Outbound pack', 'What ground truth leaves the facility?', 'Managed network', 'E4', [
    'Order-linked scan, serialized SKU, quantity, calibrated weight, station/operator ID, timestamp, pack images.',
    'Expected-versus-measured weight and quantity within tolerance; serials match order.',
    'Vision describes visible contents and legibility; it does not override scale or scanner records.',
    'Capture protocol requires complete label, container, contents, and calibration record.',
    'Seal and release with evidence manifest.',
    'Operator can rescan, recalibrate, or flag a packing exception before custody transfer.',
    'Outbound custody',
  ]),
  checkpoint(6, 'OUTBOUND_CUSTODY', 'Fulfillment', 'Outbound custody', 'Did the expected parcel enter carrier custody?', 'Merchant integrated', 'E3', [
    'Label, carrier scan, facility handoff, parcel weight, dimensions, service level, custody timestamp.',
    'Origin and time align; weight delta is within carrier tolerance.',
    'Highlights gaps or conflicting scans without inventing a custody event.',
    'Carrier acceptance or documented exception is required for protected status.',
    'Continue in transit; monitor custody chain.',
    'Merchant supplies handoff manifest or requests carrier trace.',
    'Delivery & possession',
  ]),
  checkpoint(7, 'DELIVERY_POSSESSION', 'Fulfillment', 'Delivery & possession', 'Was delivery evidence sufficient for the service level?', 'Merchant integrated', 'E3', [
    'Carrier delivery scan, photo/signature if available, GPS precision band, timestamp, delivery instructions.',
    'Delivery location and promised window align; proof quality is scored independently.',
    'Summarizes evidence and missing context; never identifies a person from a porch image.',
    'High-value orders may require signature; absence creates review, not automatic shopper fault.',
    'Record possession evidence and open the return window.',
    'Shopper reports nonreceipt, safe-location issue, or accessibility need with supporting context.',
    'Return request',
  ]),
  checkpoint(8, 'RETURN_REQUEST', 'Return', 'Return request', 'Approve, ask a question, or review eligibility?', 'All GMV', 'E2', [
    'Order, item, reason, requested remedy, policy window, history, product attributes, shopper narrative.',
    'Eligibility, item value, reason consistency, repeat-return rate, confirmed prior outcomes.',
    'Classifies the request and identifies evidence needed; shopper text is treated as untrusted data.',
    'Eligible requests pass unless a narrow, explainable exception requires evidence.',
    'Approve request and present return methods.',
    'Correct the item/reason, add context, or choose exchange/store credit where policy allows.',
    'Return authorization',
  ]),
  checkpoint(9, 'RETURN_AUTHORIZATION', 'Return', 'Return authorization', 'Which method, refund timing, and safeguards apply?', 'All GMV', 'E2', [
    'Eligibility result, destination, carrier options, item handling, estimated refund, risk band, policy.',
    'Expected route/time/weight envelope and required handoff evidence are frozen before shipment.',
    'Suggests a proportionate evidence plan and explains why; no adverse action is finalized.',
    'High-value electronics refund after inspection; low-risk items may receive instant credit.',
    'Issue QR label with an evidence checklist and transparent refund timing.',
    'Choose staffed drop-off, pickup, alternate carrier, or accessibility accommodation.',
    'Reverse handoff',
  ]),
  checkpoint(10, 'REVERSE_HANDOFF', 'Return', 'Reverse handoff', 'Is there credible evidence of carrier possession?', 'All GMV', 'E3', [
    'QR/label, carrier event, staffed-drop receipt, timestamp, origin, weight if captured, shopper evidence.',
    'Receipt and carrier scan disagree; initial scan appears 620 miles from the authorized origin in 18 minutes.',
    'Calls the route physically inconsistent and requests corroboration; it does not accuse the shopper.',
    'Pause refund acceleration; keep return open for a cure window.',
    'Request drop-off receipt or carrier correction; no denial.',
    'Upload receipt, identify a label mix-up, choose pickup, or contact carrier through assisted flow.',
    'Reverse transit',
  ]),
  checkpoint(11, 'REVERSE_TRANSIT', 'Return', 'Reverse transit', 'Continue, trace, or escalate an impossible route?', 'Merchant integrated', 'E3', [
    'Ordered carrier event sequence, facilities, scan sources, measured weights, delays, service standard.',
    'Receipt barcode matches authorization and resolves the apparent origin conflict as a delayed ingest.',
    'Updates the assessment from inconsistent to plausible with an explicit evidence citation.',
    'A valid staffed-drop receipt restores normal treatment; unresolved cases get carrier trace.',
    'Clear hold and continue to warehouse receipt.',
    'Supply receipt or attest pickup details; merchant may open a trace without penalizing the shopper.',
    'Warehouse receipt',
  ]),
  checkpoint(12, 'WAREHOUSE_RECEIPT', 'Resolution', 'Warehouse receipt', 'Did the expected parcel arrive intact?', 'Managed network', 'E4', [
    'Inbound scan, label OCR, tamper view, calibrated gross weight, dimensions, station/operator, full parcel images.',
    'Inbound weight is 1.62 kg below outbound and expected-return envelope; seal appears intact.',
    'Vision reports no visible retail item in the opened parcel; image quality is sufficient for triage.',
    'Material weight mismatch plus empty-container view requires operator inspection and refund hold.',
    'Hold refund pending item inspection — reversible and time-bounded.',
    'Shopper may explain split shipment, carrier repack, wrong label, or provide handoff evidence.',
    'Item inspection',
  ]),
  checkpoint(13, 'ITEM_INSPECTION', 'Resolution', 'Item inspection', 'What was actually returned?', 'Managed network', 'E4', [
    'Six-view image set, unpacking sequence, contents, quantity, serial/barcode, product spec, weights, protocol record.',
    'Quantity 0/2 cameras; neither expected product serial was found; packaging identifiers match the authorized kit.',
    'Likely empty return (0.93) with cited frames; imitation cannot be assessed because no item is visible.',
    'Operator must confirm protocol completeness. A human decides approve, partial, request more, or deny.',
    'Escalate to merchant reviewer; model recommendation is not a denial.',
    'Shopper can submit shipment context or evidence during the 48-hour contest window.',
    'Refund settlement',
  ]),
  checkpoint(14, 'REFUND_SETTLEMENT', 'Resolution', 'Refund settlement', 'Release, partially release, or keep the hold?', 'All GMV', 'E4', [
    'Inspection finding, shopper evidence, merchant decision, policy, remedy amounts, deadlines, audit history.',
    'Evidence protocol complete; no counter-evidence received yet; timer is visible and pausable.',
    'Drafts a plain-language evidence summary and flags uncertainty for the human reviewer.',
    'Only an authorized human may finalize adverse action; appeal access is mandatory.',
    'Human review pending. No funds decision has been executed.',
    'Contest with evidence, request accommodation, or ask for a second review.',
    'Contest, appeal & recovery',
  ]),
  checkpoint(15, 'CONTEST_APPEAL_RECOVERY', 'Resolution', 'Contest, appeal & recovery', 'Uphold, overturn, compensate, or prepare evidence?', 'All GMV', 'E5', [
    'Complete versioned evidence graph, shopper appeal, reviewer identities/roles, policy, payment-channel state.',
    'Original evidence and appeal are preserved; superseding decisions never rewrite history.',
    'Compares appeal claims to evidence, drafts a summary, and can abstain when conflict remains.',
    'Second human reviewer decides. Payment evidence is prepared, never represented as submitted.',
    'Evidence ready for authorized Reclaim workflow; status is not “won” or “submitted.”',
    'Add evidence before expiry; receive reasoned outcome and correction if overturned.',
    'Closed with auditable outcome',
  ]),
]

export const lifecyclePhases = ['Purchase', 'Fulfillment', 'Return', 'Resolution'] as const

export const checkpointScope = (number: number): 'Proposed extension' | 'Adjacent integration' | 'Core return flow' | 'Managed Verify' | 'Core resolution' => {
  if (number <= 4) return 'Proposed extension'
  if (number <= 7) return 'Adjacent integration'
  if (number <= 11) return 'Core return flow'
  if (number <= 13) return 'Managed Verify'
  return 'Core resolution'
}

export type DemoState = {
  sessionId: string
  checkout: 'challenged' | 'cleared'
  checkoutMethod?: 'email-payment' | '3ds' | 'support'
  reverseLogistics: 'inconsistent' | 'receipt-reviewed' | 'cleared'
  physical: 'inspection-hold' | 'review-pending' | 'approved' | 'partial' | 'denied' | 'appealed' | 'overturned' | 'evidence-ready'
  physicalFinding: 'empty' | 'decoy' | 'wrong-item' | 'possible-imitation' | 'quantity-mismatch' | 'inconclusive'
  reviewerNote?: string
  appealExplanation?: string
  appealEvidenceName?: string
}

export const newDemoState = (): DemoState => ({
  sessionId: `demo_${crypto.randomUUID().slice(0, 8)}`,
  checkout: 'challenged',
  reverseLogistics: 'inconsistent',
  physical: 'inspection-hold',
  physicalFinding: 'empty',
})

export const formatStatus = (value: string) => value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

export const outcomeMetrics = [
  { label: 'Verified loss stopped', value: '$18,420', note: 'Confirmed outcomes only', tone: 'orange' },
  { label: 'Estimated deterrence', value: '$7,980', note: 'Experiment-adjusted estimate', tone: 'violet' },
  { label: 'Legitimate friction', value: '1.8%', note: 'Good-actor challenge rate', tone: 'blue' },
  { label: 'Recovered', value: '$5,240', note: 'Settled payment outcomes', tone: 'green' },
] as const
