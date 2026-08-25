# Lifecycle checkpoint, evidence, action, and cure matrix

This is the operating map for all 15 evaluable checkpoints. “Available” means the artifact's `availableAt` is no later than the decision snapshot. Later warehouse or chargeback outcomes are prohibited from earlier evaluations, including offline replay.

At every checkpoint the UI shows: evidence available → deterministic signals → OpenAI recommendation → policy result → accountable action → shopper cure → next state.

## Universal action and escalation rules

- OpenAI may recommend `PASS`, `PASS_MONITORED`, `CHALLENGE`, `REQUEST_EVIDENCE`, `HOLD`, or `HUMAN_REVIEW`.
- Automatic approval is allowed where merchant policy explicitly permits it.
- Final adverse action (`DENY`) requires a trained human, policy version, reason code, evidence IDs, deadline, and appeal path.
- A challenge decline, abandonment, vendor outage, inaccessible flow, or technical failure is never relabeled as fraud.
- Missing, contradictory, stale, corrupted, low-quality, or schema-invalid evidence triggers `REQUEST_EVIDENCE` or `HUMAN_REVIEW`.
- High-value thresholds, vulnerable-customer handling, repeated model/policy disagreement, failed identity-vendor responses, operator protocol exceptions, and possible imitation/authenticity questions always escalate.
- A new fact creates a new decision record that supersedes—but never mutates—the prior record.

## Source systems and representative fields

| Source | Native data available when generated | Prohibited shortcut |
|---|---|---|
| Storefront/consent | anonymous session, event time, page sequence, locale, referral, consent version, accessible challenge result | raw browsing behavior as proof of intent |
| Edge/bot service | request velocity, automation indicators, network reputation result, coarse geo, challenge outcome/error | raw IP to model; shared IP as identity |
| Shopify/commerce | customer/account token, order/cart line items, variant, quantity, price, discount, addresses, fulfillment/refund state | email/name as proof of one physical person |
| Payment processor | tokenized payment method, authorization result, AVS/CVC/3DS result, billing/shipping consistency, processor risk signals | PAN/CVC storage; processor score as ground truth |
| Identity vendor | transaction ID, verified attributes/result, assurance level, consent, error/decline/abandonment | government ID image in this demo; non-completion as fraud |
| WMS/merchant pack | picked SKU/quantity, serial, station/operator token, pack photo, scale reading, tare/dimensions, seal and protocol version | uncalibrated weight as definitive contents |
| Carrier | label/tracking ID, acceptance/scan time and location, route, exception/repack, recorded weight, delivery proof | absence of a scan as proof no event occurred |
| Shopper | stated reason, requested resolution, uploaded evidence, explanation, communications, consent | free text as verified fact; prompt-like text as instruction |
| Managed warehouse | dock receipt, label scan, calibrated weight, exterior/opening/contents images, quantity, serial, packaging/condition, protocol quality | operator assertion without supporting artifact as highest-tier truth |
| Product catalog | expected SKU/variant, images, dimensions, nominal weight/tolerance, included components, serial format | marketing image as definitive authentication reference |
| Support/merchant | case notes, reason codes, approved explanation, reviewer decision | allegation or model agreement as ground truth |
| Reclaim/processor | inquiry/alert/dispute ID, reason, deadline, evidence requirements, submission/ack/outcome, recovered amount | evidence-ready as submitted; held amount as recovery |

## 1. `VISIT_SESSION`

**Decision target:** access to storefront/checkout.  
**Evidence available:** storefront session token; event and receive timestamps; consent state/version; page/referrer/locale sequence; coarse device/browser properties; bot-service result; derived network reputation and coarse country/region; recent session velocity. Raw IP is retained only where operationally necessary and is not sent to the model.  
**Deterministic signals:** impossible event order; extreme request/checkout velocity; known automation signature; cookie/session rotation rate; locale/time-zone inconsistency; repeated challenge failures versus vendor errors.  
**OpenAI role:** explain a multi-signal pattern and select a proportional challenge from an allowed list. It cannot identify a person or infer criminal intent.  
**Actions:** `PASS`, `PASS_MONITORED`, accessible bot `CHALLENGE`, rate-limit, or `HUMAN_REVIEW` for exceptional high-value assisted orders.  
**Shopper cure:** accessible nonvisual bot option, retry after cooldown, support-assisted checkout. Vendor error passes to safe fallback rather than fraud status.  
**Loss opportunity:** automation/bot-enabled abuse may be deterred before payment. Measure only randomized incremental confirmed outcomes and conversion harm; blocked requests are not fraud dollars.

## 2. `IDENTITY_LINK`

**Decision target:** whether a session can be safely linked to prior Redo/merchant history.  
**Evidence available:** everything from checkpoint 1 plus merchant customer/account token, verified email/phone flags, login/MFA result, account age, normalized address tokens, prior order/return/appeal/confirmed-loss outcomes that matured before the snapshot, payment/device/address graph edges, and each edge's confidence/source.  
**Deterministic signals:** conflicting verified attributes; high-degree account/device/address graph; rapid account creation; verified-channel mismatch; prior finalized case linkage. A graph edge never asserts one physical human.  
**OpenAI role:** summarize link evidence and missing attributes; recommend `PASS_MONITORED`, narrow verification, or review.  
**Actions:** continue as guest, verified-channel `CHALLENGE`, third-party identity step-up, or review.  
**Shopper cure:** verify existing email/phone, sign in, use payment step-up, approved ID vendor, or choose human review. Public demo uses synthetic vendor results only.  
**Loss opportunity:** repeat-pattern risk can be addressed before order creation. Report by resolved entity confidence and mature outcome label; do not claim “repeat fraudster” from shared identifiers.

## 3. `CHECKOUT_PAYMENT`

**Decision target:** attempt/authorize payment and accept the order.  
**Evidence available:** checkpoints 1–2 plus cart/order value, SKU/quantity, scarcity/resale/value band, discount/gift-card use, billing/shipping normalization result, tokenized payment-method history, processor authorization and risk signals, AVS/CVC/3DS result, BIN country, attempt velocity, and merchant checkout policy. No PAN or CVC enters the evidence record.  
**Deterministic signals:** payment retries across tokens; authorization failure; AVS/region conflicts; high-value new-identity order; unusual quantity; shipping/billing distance; promotion abuse pattern.  
**OpenAI role:** combine allowed facts into a bounded recommendation with evidence references and explicit uncertainty.  
**Actions:** `PASS`, `PASS_MONITORED`, 3DS/payment `CHALLENGE`, address confirmation, identity-vendor step-up, short `HOLD`, or review.  
**Shopper cure:** authenticate payment, confirm address, select another verified method, use approved identity flow, or request support. Incentive variants must be randomized and disclosed; acceptance/non-acceptance is not a truth label.  
**Loss opportunity:** order/payment abuse and later repeat return-loss exposure may be reduced. Measure downstream mature outcomes against control, net of declined legitimate conversion and margin.

## 4. `ORDER_RELEASE`

**Decision target:** release authorized order to fulfillment.  
**Evidence available:** all checkout evidence plus final authorization state, order edits, inventory allocation, shipping service/address validation, duplicate-order links, merchant review notes, fraud-tool updates available before release, and fulfillment cutoff.  
**Deterministic signals:** payment authorization reversed/expired; duplicate active order; unsupported/undeliverable address; post-checkout high-risk data change; high-risk order missing required verification.  
**OpenAI role:** explain unresolved conflicts; no final cancellation authority.  
**Actions:** release, release monitored, request address/payment confirmation, time-bound hold, cancel under an objective payment/inventory rule, or human review for risk-based adverse action.  
**Shopper cure:** confirm change through verified channel, reauthorize payment, correct address, or appeal risk hold.  
**Loss opportunity:** last pre-fulfillment point. Attribute intervention once here if this is the first stage that stops the eligible loss.

## 5. `OUTBOUND_PACK`

**Decision target:** accept the merchant's outbound contents baseline.  
**Evidence available:** order/variant/quantity; picker/packer/station pseudonymous IDs; pick and pack scans; serial/lot where supported; expected product and packaging weight/tolerance; calibrated scale reading; package dimensions/tare; packing images/video; seal ID; label ID; protocol/device calibration version.  
**Deterministic signals:** expected-versus-measured weight outside tolerance; scanned SKU/serial mismatch; missing required capture; quantity/box-capacity inconsistency; stale calibration.  
**OpenAI role:** visual quality control and visible item/quantity observations, grounded to artifact IDs.  
**Actions:** accept baseline, rescan/reshoot/reweigh, repack, supervisor review, or block handoff until the protocol is complete.  
**Shopper cure:** not applicable yet; correction belongs to merchant operations. An outbound defect must not later be blamed on the shopper.  
**Loss opportunity:** prevents merchant fulfillment errors and establishes a comparison baseline; classify separately from shopper fraud prevention.

## 6. `OUTBOUND_CUSTODY`

**Decision target:** establish carrier custody and expected route.  
**Evidence available:** manifest, carrier/tracking/service, tender time/location, acceptance scan, recorded carrier weight, origin/destination regions, planned route/SLA, package/seal ID, handoff operator/station.  
**Deterministic signals:** no acceptance after manifest window; label reuse; weight discontinuity; origin mismatch; impossible initial scan order.  
**OpenAI role:** summarize custody gaps; recommend monitoring or investigation.  
**Actions:** proceed monitored, carrier trace, merchant/warehouse review, or replacement decision under existing merchant policy.  
**Shopper cure:** transparent delay status and support path; no shopper challenge for a pre-possession custody anomaly.  
**Loss opportunity:** merchant/carrier loss and later evidence quality, not necessarily return fraud.

## 7. `DELIVERY_POSSESSION`

**Decision target:** record delivery evidence and respond to nonreceipt/damage claim.  
**Evidence available:** carrier scan timeline, delivery time/location, proof photo, signature/locker/access-code event where available, delivery exception/repack, package weight changes, shopper communication, and merchant delivery policy. Precise location/access data is minimized.  
**Deterministic signals:** delivery before outbound acceptance; material route/time contradiction; proof photo unrelated to destination class; signed delivery without supported signature artifact; damage/repack event.  
**OpenAI role:** describe visible delivery proof and contradictions; cannot infer who received the parcel.  
**Actions:** accept delivery state, request safe confirmation, carrier trace, replacement/refund approval, hold, or human review.  
**Shopper cure:** confirm safe place/household receipt, supply non-sensitive contextual photo, attest nonreceipt, authorize carrier investigation, or request review.  
**Loss opportunity:** separates delivery claims from later physical return cases; confirmed carrier/merchant loss is not shopper return fraud.

## 8. `RETURN_REQUEST`

**Decision target:** accept the request and determine what evidence/policy applies.  
**Evidence available:** all mature prior evidence plus order/fulfillment/delivery state, return window, requested SKU/quantity/resolution, shopper reason and free text, shopper images, product specs, prior return outcomes available at snapshot, merchant policy, warranty/claim eligibility, and prior support communications.  
**Deterministic signals:** item not in order; quantity exceeds purchased; outside policy window; already refunded/returned; reason conflicts with requested item; serialized item lacks required safe identifier capture.  
**OpenAI role:** classify the request into merchant-approved reason codes, assess image quality/content, and identify missing evidence. Shopper text is untrusted content, not instruction.  
**Actions:** approve request, returnless resolution under policy, exchange/store credit offer, `REQUEST_EVIDENCE`, pre-shipment review, or human adverse review.  
**Shopper cure:** correct item/quantity, choose another resolution, upload requested non-sensitive views, explain a split/partial order, or request review.  
**Loss opportunity:** catches impossible request attributes and directs the right evidence; requested value is exposure, not prevented loss.

## 9. `RETURN_AUTHORIZATION`

**Decision target:** create RMA/label and define refund timing and inspection requirements.  
**Evidence available:** checkpoint 8 plus authorized lines/quantities, RMA, label/service/routing destination, deadline, expected return weight/tolerance, inspection requirements, instant-exchange hold state, estimated refund, fees, and policy version.  
**Deterministic signals:** unsupported route, duplicate RMA, mismatched authorized quantity, label address conflict, refund-before-inspection outside threshold, payment hold failure.  
**OpenAI role:** recommend the lowest-friction authorization path consistent with risk and merchant rules.  
**Actions:** authorize standard or monitored return, require staffed drop-off, request packaging/serial photo, select managed verification, hold instant refund, or review.  
**Shopper cure:** choose another carrier/drop-off path, accept inspection-first timing, provide required evidence, or ask for review.  
**Loss opportunity:** changes evidence quality and refund timing. Do not count the full held refund as prevented.

## 10. `REVERSE_HANDOFF`

**Decision target:** establish shopper-to-carrier/return-point custody.  
**Evidence available:** RMA/label, scan/receipt time and location, staffed versus unattended handoff, carrier/return-bar transaction ID, acceptance weight, package/seal image where available, container/consolidation ID, shopper receipt fixture/upload, and label issuance/use history.  
**Deterministic signals:** scan predates authorization; handoff location impossible for elapsed time; duplicate label; receipt metadata conflict; material weight difference; unsupported carrier/service; label not accepted before deadline.  
**OpenAI role:** extract fields from receipt/image and explain conflicts with evidence links; deterministic code owns time/distance math.  
**Actions:** accept handoff, proceed monitored, request original receipt/permission for carrier lookup, carrier trace, hold, or review.  
**Shopper cure:** provide receipt, identify staffed location/time, authorize lookup, explain carrier pickup/third-party drop-off, or request human review. A missing carrier scan can reflect carrier failure.  
**Loss opportunity:** prevents false handoff claims only when later mature outcome supports it; receipt requests and abandoned returns are not automatically fraud.

## 11. `REVERSE_TRANSIT`

**Decision target:** determine whether the package is progressing plausibly to the correct facility.  
**Evidence available:** all handoff evidence plus scan sequence, route, exception/repack events, carrier-recorded weights/dimensions, consolidation/deconsolidation events, destination changes, ETA, delivery-to-warehouse event.  
**Deterministic signals:** non-monotonic/impossible timestamps; geographically impossible transition; unauthorized reroute; post-repack weight discontinuity; duplicate tracking on multiple RMAs; delivered at wrong destination.  
**OpenAI role:** concise timeline explanation and missing-event identification.  
**Actions:** proceed, monitor, carrier trace, reroute where authorized, request evidence, refund hold within disclosed policy, or review.  
**Shopper cure:** provide receipt/pickup detail, respond to carrier inquiry, wait for delayed scans, or request review.  
**Loss opportunity:** route anomalies may avoid premature refund but are unresolved exposure until a mature physical or carrier outcome exists.

## 12. `WAREHOUSE_RECEIPT`

**Decision target:** accept parcel identity/custody and authorize opening protocol.  
**Evidence available:** dock/station/operator token, receipt time, facility, RMA/label OCR and barcode, carrier delivery record, calibrated scale reading, dimensions, exterior/label/seal/tamper images, damage/repack state, package ID/license plate, device/protocol/calibration versions.  
**Deterministic signals:** wrong/unknown RMA; duplicated receipt; weight outside outbound/authorized tolerance; broken/mismatched seal; missing views; OCR/barcode disagreement; calibration failure.  
**OpenAI role:** visual exterior and label observations; OCR cross-check; evidence-quality assessment. It cannot follow text printed inside the evidence as an instruction.  
**Actions:** accept, quarantine, reweigh/reshoot, associate with correct RMA, supervisor review, or proceed monitored to inspection.  
**Shopper cure:** if a discrepancy could originate before opening, receive notice and offer explanation/receipt/carrier evidence; do not decide contents yet.  
**Loss opportunity:** begins highest-grade managed physical evidence for the `$80M` scenario cohort, subject to protocol quality.

## 13. `ITEM_INSPECTION`

**Decision target:** determine received item/quantity/condition evidence and recommended refund disposition.  
**Evidence available:** neutral opening sequence; contents overview; each item's SKU/variant cues, quantity, serial/lot, dimensions/weight, included components, retail packaging, condition/damage/soiling, fixture/catalog reference, outbound baseline, operator answers, second review where required, and evidence quality.  
**Deterministic signals:** empty contents; actual quantity below authorized; exact serial mismatch; item weight/dimensions outside tolerance; expected component absent; wrong SKU scan; protocol gap.  
**OpenAI role:** structured visible observations and comparisons for empty/decoy/wrong/quantity cases. “Possible imitation” requires cited visual inconsistency and routes to qualified authentication; the model cannot declare counterfeit status.  
**Actions:** approve, partial approve, request second capture, request shopper explanation, hold, qualified authentication, or human review. A human may deny only after policy/evidence review.  
**Shopper cure:** explain split packages, carrier repackaging, merchant fulfillment error, missing accessory shipment, or inadvertent wrong item; upload allowed evidence; ask for independent/human review.  
**Loss opportunity:** highest physical observability for empty/decoy/wrong/quantity loss. Report verified stopped value only after the final outcome matures; preserve overturns.

## 14. `REFUND_SETTLEMENT`

**Decision target:** calculate and execute the accountable merchant resolution.  
**Evidence available:** inspection disposition; authorized versus received lines; price/tax/discount allocation; return shipping/restocking policy; original tender and currency; exchange/store-credit state; instant-exchange hold; merchant approval; protection eligibility; shopper notice/deadline; processor refund ID/state.  
**Deterministic signals:** amount exceeds eligible value; duplicate refund; original-tender mismatch; missing approval for adverse outcome; expired/invalid authorization; partial quantity allocation error.  
**OpenAI role:** draft explanation from approved structured reason codes and evidence; no payment execution or denial authority.  
**Actions:** full/partial refund, exchange/store credit, release/convert authorized hold under valid terms, time-bound hold, human denial, or review.  
**Shopper cure:** contest before deadline where practicable, submit new evidence, select supported alternate resolution, or appeal final decision.  
**Loss opportunity:** this is an accounting state. Distinguish refund held, refund not issued after verified outcome, protection payout, and recovered funds.

## 15. `CONTEST_APPEAL_RECOVERY`

**Decision target:** resolve shopper appeal and, if a separate authorized payment dispute exists, manage evidence handoff/recovery.  
**Evidence available:** full versioned case timeline; shopper appeal statement/artifacts; reviewer rationale; policy/model versions; merchant communications; processor inquiry/alert/dispute ID, reason code, deadline, allowed evidence, submission state/acknowledgement/outcome; protection claim/payout; recovered amount.  
**Deterministic signals:** new evidence contradicts a prior finding; policy misapplied; deadline nearing; packet missing source/checksum; packet state inconsistent with processor acknowledgement; payout/recovery overlap.  
**OpenAI role:** summarize the appeal, compare only supported claims, draft neutral shopper communication, and draft an evidence packet for human/authorized workflow review.  
**Actions:** approve, partial approve, overturn, uphold through human decision, request evidence, close, or mark packet `EVIDENCE_READY`. Reclaim submission occurs only after an authorized event and changes state to `QUEUED`/`SUBMITTED` based on actual integration response.  
**Shopper cure:** submit permitted new facts within a visible deadline, request human review, and receive the final reason/evidence summary.  
**Loss opportunity:** report actual recovered funds only after settlement; report protection payout separately; do not add either to first-stopped prevention.

## Decision-state ownership

| State transition | Automated owner allowed? | Required record |
|---|---|---|
| pass / monitored | yes, under versioned policy | evidence snapshot, rules, model result if used, policy |
| challenge / evidence request | yes, proportionate policy | precise reason, alternatives, expiry, vendor/error states |
| time-bounded hold | yes where merchant policy/terms permit | amount/scope, owner, deadline, next action |
| approval / partial approval | yes where policy permits | calculation, policy version, settlement identifier |
| final risk-based denial | no | human reviewer, reason, evidence IDs, policy, notice, appeal |
| appeal overturn | human or objective correction policy | superseded decision, new evidence, corrected accounting |
| evidence-ready | yes | packet manifest/checksums; no submission claim |
| Reclaim submission | only authorized integration | dispute ID, channel, request/ack timestamps, external status |

## What can be quantified at each stage

Each checkpoint can display four values only when its denominator and outcome window are defined:

1. eligible exposure reaching the checkpoint;
2. observable mature fraudulent/abusive loss in control or shadow data;
3. incremental stopped outcome attributed to the first effective intervention;
4. legitimate shopper/operations cost caused by the intervention.

The product intentionally leaves checkpoint “preventable percentages” as `TBD from Redo cohort data`. Market priors cannot fill them. See [measurement-methodology.md](./measurement-methodology.md) for the estimator, waterfall attribution, and worked examples.
