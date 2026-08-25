# Production implementation plan

This plan starts after Redo accepts the problem framing. The August 31 interview build is a prototype and architecture demonstration, not a production fraud model or a promise of prevented revenue.

## Outcome and release strategy

Launch in four separately measurable layers:

1. **Evidence & Observe (free/bundled):** standardize data and evidence, draft shopper/merchant communication, assemble evidence-ready packets, and run shadow rules/scores.
2. **Predict & Decide (Pro):** calibrated recommendations, merchant policies, proportionate shopper challenges, experiments, and analytics across the broader addressable surface.
3. **Managed Verify:** Redo-operated warehouse receipt/inspection protocols that create stronger physical outcome labels.
4. **Protection (separate):** contractual risk transfer and payout accounting, never counted as model prevention.

The sequence is intentional: Evidence & Observe can create labor value and better labels before predictive claims are earned.

## Workstreams

| Workstream | First deliverable | Production owner candidates |
|---|---|---|
| Domain/event platform | versioned checkpoint/evidence/decision contracts and replay | platform + returns engineering |
| Merchant policy | policy builder, safe defaults, versioning, reviewer permissions | returns product + risk |
| Shopper cure/appeal | reason, alternatives, accessible challenge, deadline, appeal | shopper product + support |
| Warehouse protocol | capture checklist, station integration, calibration, operator QA | managed returns + ops engineering |
| OpenAI assessment | schema, prompt registry, regression set, budget/fallback | applied AI/engineering + risk |
| Integrations | Shopify/payment/carrier/WMS/identity/Reclaim adapters | integrations/platform |
| Measurement | eligible exposure, labels, randomization, friction, accounting | data science + finance |
| Security/privacy | RBAC, retention, vendor review, audit, incident plan | security + privacy/legal |
| Merchant rollout | pilot selection, configuration, enablement, SLA | merchant success + sales |

## Phase 0 — definitions and data contract (weeks 1–3)

Deliver:

- fraud/abuse/merchant-error/carrier-error/unknown taxonomy;
- exact `$80M` and `$200M` accounting definitions and membership relationship;
- eligible exposure and outcome maturity definitions;
- all 15 checkpoint native events, required timestamps, and source ownership;
- evidence tiers/protocols and appeal outcome model;
- actions Redo can make versus recommend contractually;
- data retention, identity verification, and OpenAI/vendor approvals;
- causal measurement plan and merchant pilot criteria.

Exit:

- finance, returns, risk, warehouse ops, data, security/privacy, support, and Reclaim sign off;
- event replay proves no future-data leakage;
- no unsupported “preventable percent” remains in the business case.

## Phase 1 — Evidence & Observe pilot (weeks 4–9)

Scope:

- 2–4 design-partner merchants with high manual evidence burden;
- one managed facility/category lane;
- return/RMA, carrier, support, and warehouse evidence ingest;
- required exterior/opening/contents/weight/quantity capture;
- packet drafting and neutral shopper communication;
- shadow-only deterministic and OpenAI assessments;
- reviewer and operator feedback instrumentation.

Exit gates:

- ≥95% protocol completion in eligible warehouse cases;
- artifact/source/timestamp traceability and checksum link in 100% of sampled packets;
- no PII/secret in model logs or analytics export;
- meaningful measured review-time reduction against baseline;
- an `INCONCLUSIVE` route that operators/reviewers actually use;
- zero model-initiated payment/status/submission action.

Commercial test: free/bundled evidence automation with baseline time study. This is the earliest credible time to value: approximately 4–6 weeks after the first merchant is connected.

## Phase 2 — shadow Predict & Decide (weeks 8–14, overlapping)

Scope:

- point-in-time feature materialization;
- merchant/time holdouts;
- model/policy/human disagreement capture;
- delayed outcome labels and calibration;
- cohort-specific dashboard with E-tier distribution;
- protected thresholds and review-capacity simulation.

Exit gates:

- pre-registered precision/recall/calibration and evidence-reference requirements;
- acceptable performance across merchant/category/value bands, not just pooled average;
- stable abstention and API failure behavior;
- estimated reviewer load within SLA;
- broad cohort reported separately from managed warehouse cohort;
- no warehouse-to-broad transport claim without holdout evidence.

## Phase 3 — controlled interventions (weeks 13–21)

Start with reversible, low-risk actions:

- checkout payment/bot/verified-channel step-up;
- return request evidence prompt;
- staffed drop-off or carrier lookup option;
- inspection-first hold under disclosed policy;
- second warehouse capture/review.

Randomize at a stable unit (session/order/return) before the model threshold and analyze intention to treat. Report mature loss, known-good conversion/margin, accessibility/vendor failures, support contacts, appeal, and repeat purchase.

Exit gates:

- experiment sample-ratio and exposure logging pass;
- statistically/operationally meaningful incremental value with confidence interval;
- legitimate shopper harm within jointly approved bounds;
- no final adverse decision without human record;
- appeal and correction accounting operates before enforcement expands.

Commercial test: fixed paid pilot or Pro fee credited to launch. Earliest defensible paid-Pro evidence is roughly 12–20 weeks and depends on outcome incidence/maturity.

## Phase 4 — managed expansion (weeks 20–32)

- expand protocols by site/category;
- integrate station device health and scale calibration;
- blind duplicate inspections and site/operator QA;
- async evidence/model worker and DLQ;
- live identity/vendor and Reclaim adapters only after approvals;
- merchant policy templates with exceptions and SLA;
- security/tenant/RBAC/retention hardening.

Exit: stable evidence yield and decision cycle by site/category, reliable reconciliation, on-call readiness, and merchant training/support materials.

## Phase 5 — Pro launch and scale (approximately months 6–9)

- self-serve/assisted merchant enablement;
- pricing and contractual scope;
- feature flags, model/policy rollout registry, kill switch;
- cohort monitoring, appeals, incidents, and monthly value review;
- finance-approved reporting that never double counts prevention/recovery/protection;
- controlled expansion toward the Q1 2028 managed-warehouse scenario.

## Candidate backlog by priority

### P0 safety/contracts

- tenant authentication and case RBAC;
- point-in-time evidence filter and leakage test;
- human-only final denial invariant;
- appeal supersession and settlement correction;
- OpenAI strict schema/reference validation/fallback;
- idempotency for action/refund/submission;
- retention and data deletion workflow;
- warehouse protocol/quality gate;
- mutually exclusive economic ledger.

### P0 product

- shopper reason/alternative/deadline component;
- merchant case timeline and evidence preview;
- operator RMA/weight/photo/quantity flow;
- all 15 checkpoint explorer;
- merchant policy configuration and versioning;
- cohort/experiment dashboard with definitions.

### P1 integrations/scale

- signed webhooks and reconciliation;
- queue/worker/DLQ and provider retry;
- WMS/capture hardware adapter;
- identity-vendor hosted flow;
- Reclaim evidence state callback;
- data warehouse export and governed feature/label registry.

### P2 expansion

- contributor rewards for consented, protocol-valid evidence;
- additional fraud families;
- merchant-upload capture SDK;
- category-specific authentication partners;
- protection eligibility/risk integration kept separate from score.

## Contributor rewards guardrails

Rewards for photos, weights, or verified warehouse/shipping data can improve coverage only when they do not create label manipulation incentives.

- Reward protocol completion/quality, not “fraud found.”
- Deduplicate artifacts/cases and reject copied/unrelated images.
- Separate merchant/operator contributor identity from shopper risk decisions.
- Blind a QA sample and track reversal/quality by contributor.
- Require data rights, consent, notice, retention, and permitted model use.
- Do not let reward eligibility change the shopper decision.

Start as noncash recognition/pilot credit until gaming, tax, contract, and accounting are reviewed.

## RACI for critical decisions

| Decision | Accountable | Responsible | Consulted |
|---|---|---|---|
| outcome/economic definitions | Finance | Data | Risk, product, merchant success |
| model enforcement gate | Risk/Product | Applied AI/Data | Security, support, legal/privacy |
| warehouse truth protocol | Managed Returns | Ops engineering | Data, risk, merchant ops |
| final adverse action policy | Merchant / Redo product contract owner | Merchant risk reviewer | Legal, support, product |
| identity workflow | Security/privacy | Integrations | Legal, support, accessibility |
| Reclaim submission | Payments/Reclaim | Integrations | Merchant, legal, support |
| incident kill switch | Engineering/Security | On-call | Product, risk, support |

## Time-to-revenue framework

| Value | When measurable | Monetization hypothesis |
|---|---|---|
| evidence/review labor savings | 4–6 weeks after connected pilot | bundled/free wedge, then operations tier |
| warehouse cycle/quality improvement | 6–12 weeks | Managed Verify SLA/processing economics |
| causal avoided loss at limited checkpoints | 12–20+ weeks, outcome-dependent | paid Pro pilot/platform usage |
| repeatable cross-merchant Pro value | 6–9 months | tiered SaaS/usage; audited value component possible |
| protection economics | only after actuarial/contract review | separate price/coverage, never prevention fee |

No time-to-revenue estimate should use `$80M × market fraud rate` or `$200M × model recall`. Build a bottom-up merchant cohort model using eligible returned value, mature merchant-specific loss, intervention lift, legitimate friction, operations cost, and sales/onboarding capacity.

## Go/no-go review packet

- metric dictionary and data-quality report;
- experiment protocol/results with intervals and sample-ratio check;
- merchant/category cohort slices and warehouse transport analysis;
- false-positive case review and appeal/overturn report;
- privacy/security/accessibility approvals;
- operations staffing/SLA and incident/rollback plan;
- finance ledger reconciliation;
- merchant qualitative feedback and implementation cost;
- model/prompt/policy/protocol version release notes.
