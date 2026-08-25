# Redo Return Integrity — product specification

Status: interview prototype specification  
Owner: Canyon Smith (candidate proposal; not an official Redo roadmap)  
Prepared: August 24, 2026  
Demo delivery target: Monday, August 31, 2026

## Executive outcome

Redo Return Integrity is an evidence-led decision layer spanning checkout through appeal. It gives a legitimate shopper a proportionate way to resolve doubt, gives merchants a time-bounded and reviewable decision, gives operators an evidence-capture workflow, and gives Redo a clean learning loop from high-quality warehouse outcomes.

The first implemented fraud family is **empty return, decoy/wrong item, possible imitation, and quantity mismatch**. The prototype also exposes every lifecycle checkpoint so future fraud families can use the same contracts.

The system recommends; policy and accountable people decide. OpenAI never directly issues a final adverse outcome. Challenge abandonment, technical failure, and refusal to provide optional data remain distinct outcomes—not fraud labels.

## Problem

Return decisions are fragmented across storefront, identity, payment, order, carrier, warehouse, support, and processor systems. A signal that looks suspicious at one point may be explained later. Conversely, a refund may be issued before physical evidence exists. Three failures follow:

1. **Unnecessary shopper friction.** Broad rules punish good customers because evidence is incomplete.
2. **Unrecoverable merchant loss.** Inconsistent photos, weights, timestamps, and communications make review and later dispute handling slow or weak.
3. **Unmeasurable claims.** Declined challenges are counted as fraud, merchant allegations are treated as ground truth, overlapping interventions are added twice, or merchant GMV is confused with Redo revenue.

## Product principles

1. **Point-in-time only.** An evaluation sees only evidence whose `availableAt` is at or before the checkpoint snapshot.
2. **Facts, signals, recommendations, policy, and decisions are separate records.** None silently overwrites another.
3. **Every doubt has a cure path.** The shopper can verify, supply alternate evidence, wait for an observable event, or request human review.
4. **Proportional friction.** Use the least intrusive challenge that can resolve the specific uncertainty.
5. **No model-issued final denial.** A trained merchant reviewer owns final adverse action and records reason, policy version, and evidence IDs.
6. **Abstention is a valid result.** Missing, conflicting, low-quality, or adversarial evidence routes to more information or review.
7. **Ground truth is earned.** Warehouse protocol evidence can be strong; a prediction, non-response, or merchant assertion is not truth.
8. **Causal prevention is measured experimentally.** Non-verification is not counted as prevented fraud.
9. **Protection is not prevention.** A reimbursement or contractual transfer is reported separately from avoided loss and recovered funds.
10. **Evidence-ready is not submitted.** Reclaim handoff occurs only through an authorized processor, inquiry, alert, or dispute workflow.

## Personas and jobs

### Shopper

- Understand why a checkout, return, or refund is paused.
- Resolve doubt without having to infer what evidence is acceptable.
- Use an alternate path when a document, device, carrier receipt, or image is unavailable.
- See the deadline, current owner, and next state.
- Contest a proposed adverse decision with evidence and receive human review.

### Merchant risk/operations manager

- Configure policy thresholds by merchant, product, value, region, and evidence quality.
- See evidence provenance and what was knowable at the decision time.
- Approve, partially approve, request evidence, hold, escalate, deny, or overturn.
- Quantify verified outcomes, shopper friction, labor saved, and actual recovery without double counting.

### Warehouse or ground-truth operator

- Scan an RMA/label and follow a consistent photo, seal, quantity, weight, serial, and condition protocol.
- See expected SKU/quantity/specification without being biased by a model accusation.
- Mark evidence quality problems and reshoot before closing the inspection.
- Preserve custody and protocol version.

### Redo product/data/risk team

- Observe all 15 checkpoints through one versioned event contract.
- Run shadow and randomized evaluations safely.
- Improve broad-surface prediction using consented, quality-scored managed-warehouse outcomes.
- Audit model, policy, and human disagreement.

### Merchant support and chargeback analyst

- Generate shopper-facing explanations from approved reason codes.
- Assemble an evidence-ready packet linked to original artifacts.
- Route the packet to Reclaim only after an authorized dispute event and verify submission state separately.

## Product packaging

| Layer | Buyer value | Core scope | Measurement |
|---|---|---|---|
| Evidence & Observe (free) | Reduce manual evidence assembly and create usable labels | Ingest return/order/carrier facts; capture photos/weights; draft communications; create evidence-ready packets; shadow scores only | coverage, protocol completion, review minutes saved, label maturity |
| Predict & Decide (Pro) | Apply calibrated risk recommendations and merchant policy across the broader surface | Point-in-time evaluation, challenges, thresholds, experiments, case routing, merchant analytics | incremental verified loss avoided, friction, calibration, net value |
| Managed Verify | Highest-quality physical evidence and faster operational decisions | Redo warehouse receipt, weight, imaging, quantity/serial/condition protocol, operator QA | evidence yield, agreement, cycle time, recoverable value |
| Protection (separate) | Contractual risk transfer under defined eligibility | coverage/payout rules and settlement accounting | premiums/fees, covered loss, payouts, exclusions—not “fraud prevented” |

Evidence & Observe is deliberately useful before predictive accuracy is proven. It creates the evidence loop. Predict & Decide is earned only after shadow performance, bias/friction review, and controlled measurement clear launch gates.

## First three end-to-end journeys

### A. Good actor clears checkout uncertainty

1. Visit, identity-link, checkout, and order-release evidence is evaluated.
2. A deterministic mismatch (for example, high-velocity checkout plus inconsistent billing signal) creates a narrow `CHALLENGE` recommendation—not a fraud label.
3. The shopper chooses one of: low-friction bot challenge, payment-method step-up, address confirmation, third-party identity verification, or human review. The demo uses synthetic verification; it never collects a real government ID.
4. Valid completion passes the order with monitoring. Decline, abandonment, and technical failure are recorded distinctly and governed by merchant policy.
5. A randomized incentive variant may test challenge completion and conversion; it does not convert completion or non-completion into ground truth.

Acceptance: no challenge state can become `DENY` without a human decision, a policy reason, and evidence references.

### B. Impossible reverse logistics is explained or escalated

1. At return request/authorization/handoff/transit, the rules engine computes route, time, scan order, duplicate-tracking, and origin/destination feasibility.
2. Impossible or conflicting sequences return `REQUEST_EVIDENCE` or `HUMAN_REVIEW`.
3. The shopper can upload a synthetic/fixture drop-off receipt, provide the staffed-location/time, authorize carrier lookup, or ask for review.
4. New evidence is appended. The prior decision remains immutable and a new evaluation supersedes it.
5. Carrier uncertainty or outage cannot produce an automatic denial.

Acceptance: timeline calculations are deterministic and unit-tested; the language model explains conflicts but does not invent scans.

### C. Empty, decoy, wrong, possible imitation, or incomplete return

1. Warehouse operator scans RMA and captures scale reading, sealed-package views, opening sequence, contents, quantity, distinguishing marks, and serial where policy permits.
2. Deterministic checks compare expected versus measured quantity, shipped/return weight deltas, serial values, and required views.
3. OpenAI image analysis returns structured observations with per-claim evidence IDs, uncertainty, quality issues, and an explicit abstention path.
4. Merchant policy decides whether to auto-approve, hold, request information, partially approve, or route to human review. Final denial remains human-only.
5. Shopper sees the evidence and deadline, and may explain split shipments, carrier repackaging, missing accessories, item substitution errors, or submit new evidence.
6. If unresolved at the deadline, the configured merchant policy determines the accountable decision; the merchant is compensated only through the actual commercial/protection contract, not by a demo assumption.
7. If an authorized processor dispute later exists, an evidence packet becomes eligible for Reclaim handoff. `EVIDENCE_READY`, `QUEUED`, `SUBMITTED`, `ACKNOWLEDGED`, and `RESOLVED` are distinct states.

Acceptance: image evidence cannot be the only basis for an imitation/counterfeit assertion; the model must use “possible inconsistency” unless validated by an authorized authentication process.

## Lifecycle decision contract

Every checkpoint renders the same contract:

```text
native facts
  -> deterministic signals
  -> OpenAI assessment (structured, bounded, may abstain)
  -> versioned merchant policy result
  -> accountable final action
  -> shopper cure / appeal
  -> next lifecycle state
```

The 15 checkpoints, cumulative evidence, decision options, escalation criteria, and cure paths are specified in [lifecycle-decision-matrix.md](./lifecycle-decision-matrix.md).

## Decision vocabulary

Targets: `CHECKOUT`, `ORDER`, `RETURN_AUTHORIZATION`, `REFUND`, `APPEAL`, `PAYMENT_CASE`.

Actions:

- `PASS`: proceed with no added friction.
- `PASS_MONITORED`: proceed and retain allowed signals for a later checkpoint.
- `CHALLENGE`: present a proportionate verification step.
- `REQUEST_EVIDENCE`: specify the missing fact and acceptable alternatives.
- `HOLD`: time-bounded pause with owner and deadline.
- `HUMAN_REVIEW`: accountable reviewer resolves ambiguity.
- `APPROVE`: grant the requested outcome.
- `PARTIAL_APPROVE`: grant the verified portion; explain the remainder.
- `DENY`: final adverse action; human-only in this design.
- `OVERTURN`: supersede a prior adverse decision after appeal/new evidence.
- `CLOSE`: complete with a reason and final accounting state.

OpenAI can recommend only `PASS`, `PASS_MONITORED`, `CHALLENGE`, `REQUEST_EVIDENCE`, `HOLD`, or `HUMAN_REVIEW`. Policy may automatically approve when merchant rules and evidence permit. `DENY` requires a `HumanDecision`.

## Functional requirements

### Evidence

- Each artifact has source, observed/available/received timestamps, checksum where applicable, protocol version, provenance tier, privacy class, and allowed use.
- Evaluations reject evidence from the future relative to `snapshotAt`.
- Images retain an immutable original in production; the public demo uses synthetic fixtures or optional short-lived uploads and strips browser EXIF.
- Required warehouse views are visible before an operator completes a protocol.
- Any model claim references one or more evidence IDs or is marked unsupported.

### Decisioning

- Deterministic rules execute before model analysis and remain visible.
- OpenAI receives only the minimum point-in-time evidence required for the checkpoint.
- Structured output is schema-validated; invalid output or API failure becomes `HUMAN_REVIEW`, never denial.
- Merchant policy versions are immutable after use.
- Human decisions include reviewer role, reason code, note, timestamp, and evidence IDs.

### Shopper fairness

- Every non-pass state displays plain-language reason, requested information, alternatives, deadline, and appeal route.
- Government ID is not collected by the demo. A production step-up would use an approved identity vendor and store only the minimum result/token permitted by contract.
- Technical failure, refusal, abandonment, and mismatch are separate events.
- Accessibility target is WCAG 2.2 AA for the production path; prototype checks cover keyboard operation, focus, labels, contrast, and responsive layouts.

### Merchant/operator

- Merchant can approve, partially approve, request evidence, hold, or escalate from one case page.
- Only an authorized reviewer role exposes final denial.
- Operator capture uses a neutral checklist and quality gate.
- Case timeline shows superseded decisions and evidence availability.

### Analytics

- Report denominators, cohort definition, eligibility, observation window, and ground-truth tier.
- Show broad-surface and managed-warehouse cohorts separately.
- Do not add “prevented,” “recovered,” “protected,” or “held” dollars.
- Show shopper conversion/friction next to risk benefit.

## Non-functional requirements

- Anonymous demo sessions are isolated with 24-hour TTL and a reset control.
- The prototype exposes a presigned-upload scaffold for JPEG/PNG/WebP up to 5 MB and a 24-hour lifecycle target, but an uploaded object is explicitly **not decision evidence** because finalize-time magic-byte/checksum validation is not implemented. Demonstrated decisions use curated synthetic fixtures. Production requires browser EXIF removal plus server finalization before evidence creation.
- Maximum 30 model evaluations per session and 250 per UTC day for the public demo.
- The OpenAI secret is fetched server-side from AWS Secrets Manager; no key reaches the browser, repository, Lambda environment, logs, or synthesized template.
- `store: false` is set for OpenAI requests. Prompt injection in an image or text artifact is treated as untrusted evidence, never as an instruction.
- CloudFront serves a private S3 origin through OAC. `/api/*` is uncached and routed to API Gateway/Lambda.
- Audit data and opted-in waitlist data use separate DynamoDB tables and retention policies. The waitlist notice states a 30-day active-retention target and that AWS TTL deletion plus retained backups may lag under the applicable deletion policy.

## Market context and qualification

NRF and Happy Returns reported a surveyed-retailer estimate of a 16.9% 2024 return rate and $890B of returned merchandise. NRF and Appriss separately reported 13.7% of 2023 returned merchandise associated with the combined category “fraud and abuse.” These are market-level studies with different methodologies; neither is a Redo-specific base rate and neither should be applied directly to this proposal's dollar scenarios. Sources and limitations are registered in [sources.md](./sources.md).

The product adjacency is grounded in Redo's current public footprint: configurable returns/claims, Verify warehouse processing, Returns APIs, and Reclaim chargeback workflows. This proposal extends those surfaces with a common evidence and decision contract; it does not claim those extensions already exist.

## Scenario model: `$80M` and `$200M`

For this exercise only:

- `$200M` is the **broader addressable surface** where early digital and logistics signals could theoretically operate.
- `$80M` is the **managed-warehouse subset** where Redo-controlled receipt and inspection protocols could produce stronger physical ground truth by Q1 2028.

Both require finance validation. They must not be described as Redo revenue unless finance confirms that definition. The correct loss denominator is eligible returned merchandise or eligible refund exposure—not topline software revenue or total sales. The managed subset can improve broad-surface features only after protocol quality, selection bias, label delay, merchant mix, and leakage are evaluated.

## KPIs and launch gates

### North-star pair

1. **Incremental verified loss avoided per 1,000 eligible returns**, treatment versus control, with confidence interval.
2. **Incremental legitimate shopper harm per 1,000 eligible sessions**, including conversion loss, added time, repeat contacts, appeal overturns, and satisfaction.

Neither is presented without the other.

### Evidence KPIs

- evidence coverage by checkpoint and source;
- warehouse protocol completion and reshoot rate;
- percent of claims with valid evidence references;
- label maturity and time-to-label;
- inter-reviewer/operator agreement;
- artifact/source/timestamp integrity error rate.

### Model/policy KPIs

- precision/recall and calibration by merchant, channel, product group, value band, and evidence tier;
- abstention rate and review yield;
- policy/model/human disagreement;
- false-positive and false-negative cost;
- challenge completion, technical failure, abandonment, and alternate-path use—reported separately.

### Operations KPIs

- median/p90 decision time;
- operator capture time;
- merchant review minutes per case;
- support contacts per case;
- appeal rate, overturn rate, and deadline compliance.

### Financial KPIs

- verified loss stopped;
- experimental estimated deterrence;
- actual recovered funds;
- protection payouts/risk transfer;
- refund value held and later released;
- labor savings;
- legitimate gross-margin loss attributable to friction;
- program/model/vendor cost and net value.

### Initial production gates

- 100% point-in-time leakage tests pass.
- 0 model-only final denials.
- 100% adverse decisions have reviewer, policy version, reason code, and evidence link.
- calibration and friction thresholds agreed with risk, support, legal/privacy, and merchant success.
- warehouse protocol completeness at least 95% during pilot.
- appeal/overturn monitoring active before enforcement.
- minimum experiment sample determined prospectively; no stopping on favorable daily noise.

## Cross-team dependencies

| Team | Required decision or artifact |
|---|---|
| Returns product | checkpoint ownership, shopper states, merchant policy surfaces |
| Managed Returns / warehouse ops | capture stations, protocol, calibration, neutral operator UX, QA |
| Reclaim / payments | authorized dispute event, evidence contract, submission status callbacks |
| Data / ML | identity graph policy, feature definitions, label maturity, evaluation registry |
| Platform / integrations | Shopify, payment, carrier, WMS, and Redo Returns event contracts |
| Security / privacy / legal | notice, retention, biometrics/identity-vendor review, data subject workflow, model terms |
| Merchant success | pilot selection, policy configuration, training, escalation SLA |
| Finance | `$80M`/`$200M` definitions, margin/cost assumptions, prevented-versus-recovered accounting |
| Support | shopper explanations, appeal path, accessibility, incident escalation |

## Implementation and realistic timeline

### Interview build: August 24–31, 2026

- Day 1–2: domain contracts, three synthetic journeys, brand foundation, AWS stack.
- Day 3–4: OpenAI structured assessment, operator/merchant/shopper interactions, lifecycle explorer.
- Day 5: measurement lab, waitlist, responsive/accessibility pass.
- Day 6: integration, unit/E2E/security tests, failure-path review.
- Day 7: deploy, public-link verification, documentation, Loom recording.

This demonstrates architecture and product judgment; it does not establish production model efficacy.

### Production path after internal approval

| Phase | Duration | Scope | Exit criteria |
|---|---:|---|---|
| 0. Definitions and data contract | 2–3 weeks | loss taxonomy, action ownership, event/evidence schema, retention | finance/security/risk sign-off |
| 1. Evidence & Observe pilot | 4–6 weeks | 2–4 merchants; packet drafting; warehouse protocol at one site; shadow only | ≥95% protocol completion; evidence traceability; measured labor baseline |
| 2. Shadow Predict & Decide | 4–6 weeks | calibrated recommendations, no shopper friction, delayed labels | pre-registered accuracy/friction readiness gates |
| 3. Controlled checkout/return pilot | 6–8 weeks | randomized challenge and policy treatment; human adverse decisions | causal value with acceptable shopper harm |
| 4. Managed Verify expansion | 8–12 weeks | more sites/categories, QA, device/WMS integrations | stable evidence quality by site/category |
| 5. Pro launch | 4–8 weeks after gates | pricing, contracts, merchant controls, monitoring and support | repeatable onboarding and positive net value |

Earliest defensible **time to first value** is 4–6 weeks through Evidence & Observe labor savings. Earliest defensible **paid Pro evidence** is approximately 12–20 weeks, contingent on sufficient outcomes and experiment power. Broad launch is plausibly 6–9 months; Q1 2028 warehouse scale is an input scenario, not a promise made by this document.

## Rollout and pricing hypothesis

1. Offer Evidence & Observe free or bundled to reduce merchant labor and produce consistent, consented evidence.
2. Price Pro as a transparent platform/usage tier, then validate a value-based component only after causal savings can be audited. Avoid incentives that reward overblocking.
3. Include Managed Verify in warehouse processing economics with protocol and SLA tiers.
4. Quote Protection separately as coverage/risk transfer with explicit terms.

Candidate tests:

- free evidence packet versus current manual workflow;
- Pro per-order or per-evaluated-return price bands;
- fixed pilot fee credited toward launch;
- optional shared-savings component based only on agreed, auditable, incremental outcomes—not held or alleged amounts.

## Major risks and mitigations

| Risk | Consequence | Mitigation |
|---|---|---|
| Selection bias in warehouse cohort | model fails on broader merchants | cohort-aware validation, reweighting only when defensible, holdout merchants |
| Non-response labeled as fraud | inflated savings and shopper harm | distinct outcome taxonomy; outcome follow-up; never ground truth |
| Visual overconfidence | false wrong-item/imitation claims | deterministic checks, evidence references, quality gate, abstention, human review |
| Model drift or prompt injection | unstable decisioning | strict schema, version registry, untrusted-evidence boundary, regression set, kill switch |
| Future-data leakage | misleading offline performance | `availableAt` snapshot enforcement and tests |
| Double-counted dollars | untrustworthy ROI | mutually exclusive accounting ledger and first-stopped attribution |
| Operator bias/inconsistency | unreliable labels | neutral UI, training, blind duplicate review, calibration checks |
| Identity/privacy overcollection | regulatory and trust harm | approved vendor, data minimization, alternatives, no real ID in public demo |
| Processor premature submission | unauthorized dispute action | evidence state machine; Reclaim handoff only after authorized event |
| Merchant policy conflict | inconsistent treatment | versioned policies, validation, review SLAs, merchant-level reporting |

## Open questions for Redo

1. What do the `$80M` and `$200M` figures measure, at what grain, and over what period?
2. Which decisions can Redo make contractually versus recommend to a merchant?
3. What is the current warehouse capture hardware, WMS event model, and protocol completion rate?
4. Which native outcomes are trustworthy today for empty, wrong-item, quantity, and imitation cases?
5. What shopper challenge and identity vendors are already approved?
6. Which Reclaim submission channels and processor status callbacks are authoritative?
7. What appeal SLA, notice, and retention requirements apply by merchant and jurisdiction?
8. Which merchant cohorts have enough eligible exposure and outcome maturity for a controlled pilot?
