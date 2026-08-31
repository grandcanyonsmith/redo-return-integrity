# Security, privacy, and responsible decisioning

This document describes prototype controls and production gates; it is not a compliance certification or legal opinion.

## Data classification

| Class | Examples | Prototype treatment |
|---|---|---|
| `PUBLIC` | synthetic merchant/product copy, public fixtures | may be cached in web bucket |
| `PSEUDONYMOUS` | random session/case ID, synthetic customer token | main table; 24-hour session expiry |
| `CONTACT` | opted-in waitlist email, role, company URL | separate table; hash dedupe; 30-day TTL |
| `SENSITIVE_COMMERCE` | order, address consistency, payment result, carrier/case evidence | synthetic only in public demo |
| `BIOMETRIC_OR_ID` | government ID image, face template | prohibited in public demo; future approved vendor only |
| `SECRET` | OpenAI API key, signing credentials | Secrets Manager/server only; never logged or returned |

## Public-demo privacy boundary

- SKIMS, its shoppers, orders, tracking events, payment results, warehouse images, and disputes are fictional/synthetic.
- Users are told not to upload a government ID, face, real shipping label, or another person's personal data.
- The browser camera path re-encodes a bounded image, which strips ordinary EXIF metadata when canvas encoding succeeds, then computes SHA-256 and uses the completed intake-upload protocol before an MCP tool can consume the evidence ID. Nonfixture REST/MCP contracts expose no inline image source. Curated synthetic fixtures remain the preferred public path.
- The separate intake upload API issues a 60-second presigned S3 POST for declared JPEG/PNG/WebP up to 5 MiB and explicitly marks the object “not evidence.” Its policy fixes the exact declared byte length, MIME type, SHA-256 checksum, purpose, and metadata. S3 receives a random purpose-scoped key and a domain-separated one-way session binding, never the raw bearer-like session ID.
- Completion requires the S3 version ID returned by the POST and validates that exact version with checksum-enabled `HEAD` and `GET`, including session binding, purpose, metadata, actual/declared size, content type, image magic bytes, S3 checksum, and recomputed SHA-256. Completed metadata stores the key, immutable version, and exact purpose; a label lookup requires `RETURN_LABEL`, package analysis/drafting requires `PACKAGE_CONTENTS`, and cross-purpose use returns `403 EVIDENCE_PURPOSE_MISMATCH`. Inspection/draft records do not persist expiring signed read URLs, and authorized consumers receive a fresh five-minute URL for the exact version. The upload form itself expires after 60 seconds.
- The case-scoped upload route remains a nonfinalized scaffold. Intake completion establishes file integrity and session binding for the demo; it is not malware/polyglot clearance, qualified product authentication, or litigation-grade chain of custody.
- OpenAI requests use `store: false` and the minimum checkpoint evidence.
- If model access, provider billing, request execution, strict-schema parsing, or evidence-reference validation fails, the result is `SAFE_FALLBACK`/`INCONCLUSIVE`; no adverse action is inferred.
- Waitlist submission requires affirmative consent and notice version. It does not send email.
- Canyon Smith is the stated controller for prototype waitlist leads; production Redo ownership would require a new notice and agreement.
- Waitlist notice: **30-day active-retention target; AWS TTL deletion and retained backups may lag per policy.** TTL is not presented as an exact physical-deletion clock.

## Identity verification

The demo simulates an identity-vendor result. It does not ask for or store real ID. A production flow must:

1. use a Redo-approved vendor and hosted capture where possible;
2. document lawful basis, notice, data ownership, retention, subprocessor, geography, and deletion;
3. store only the minimum result token/verified attributes necessary;
4. provide an accessible alternative/human review;
5. record `DECLINED`, `ABANDONED`, and `TECHNICAL_FAILURE` separately;
6. prohibit the result from becoming a standalone fraud label.

## Authorization and tenant isolation

The interview build uses isolated anonymous sessions, not production merchant authentication. Session IDs must be high-entropy bearer capabilities, never sequential. API reads/writes are scoped to the presented session and case relationship, and expired sessions are rejected even if TTL cleanup has not yet removed the record.

One deliberate exception is the seed lookup layer: the five fictional return profiles and twenty label/RMA/order/tracking aliases are globally keyed synthetic fixtures, not tenant-scoped data. Any anonymous demo session that knows a seeded alias can resolve its fictional profile. This is acceptable only because the records contain no real merchant or shopper data; it is a production blocker, not a reusable authorization design.

Before real merchant data:

- integrate Redo staff and merchant SSO;
- prefix return-profile and alias keys with the authenticated tenant and bind every lookup, evidence, inspection, draft, review, and outbox record to that tenant;
- enforce server-side tenant/role checks on every object;
- separate shopper, operator, merchant reviewer, support, and administrator permissions;
- require step-up for final denial, export, retention override, and integration submission;
- test horizontal/vertical authorization and signed-URL scoping.

## Threat model

| Threat | Control in prototype | Production follow-up |
|---|---|---|
| secret exposure | Secrets Manager reference; server fetch; secret scans; no browser key | rotation, access alert, scoped environment/account |
| direct S3 read | Block Public Access + CloudFront OAC | access-log review, WAF/signed delivery if needed |
| upload malware/polyglot | signed exact-size/checksum policy, allowlist, MIME-signature, immutable-version and session/purpose validation; no execution; synthetic-fixture default | quarantine, dedicated malware/polyglot scanning, content disarm where appropriate |
| upload-form replay/cost abuse | 60-second expiry; replay remains bound to the same random key, exact bytes, MIME, checksum, purpose, and metadata; 12 policies/session and 120/day issuance limits | single-use issuance record, authenticated tenant byte quotas, storage-cost alarm, WAF/anomaly alerts |
| prompt injection in image/text | evidence is data; fixed system/schema; no tools or action authority | adversarial regression suite and red-team review |
| cross-session access | random session, server relationship checks, private buckets; globally keyed lookup contains synthetic records only | authenticated tenant RBAC, tenant-prefixed aliases/profiles, downstream tenant binding, and authorization tests |
| cross-purpose evidence use | completed evidence records immutable purpose; consuming service requires `RETURN_LABEL` or `PACKAGE_CONTENTS` exactly | tenant-aware evidence policy, negative authorization suite, custody review |
| model exfiltration/overcollection | minimum fields, `store:false`, no raw ID/PAN/IP | vendor/data-flow review, field-level allowlists |
| denial of service/model cost abuse | API throttle, 30 model evaluations/session, 250/day, 5 MiB/object upload cap | WAF, tenant budgets, anomaly alert, queue/backpressure |
| false adverse action | model cannot deny; human evidence review; appeal | QA sampling, dual control for high value, fairness monitoring |
| replay/duplicate settlement | idempotency/action state machine | provider reconciliation and signed webhooks |
| evidence tampering | checksum/source/timestamps/protocol; append-only decisions | immutable archive where required, custody audit |
| PII in logs | structured allowlisted log fields | automated log scanning, SIEM, access review |

## OpenAI control boundary

The model may:

- extract visible label/receipt fields;
- describe visible contents and evidence quality;
- compare supplied structured facts;
- explain deterministic conflicts;
- recommend a bounded nonfinal action;
- draft communications/packet content from approved facts.

The model may not:

- determine a physical person's identity;
- declare criminal/fraudulent intent;
- declare an item counterfeit without qualified authentication;
- make a final denial;
- execute a refund, payment, order cancellation, or return status update;
- contact a shopper or submit evidence;
- retrieve unrelated personal history;
- follow instructions embedded in uploaded evidence.

Each request includes model, prompt, and response-schema versions; a hashed safety identifier; `store:false`; and only the evidence allowed for that checkpoint. Package-inspection and communication-draft records also retain a bounded `modelAudit`: provider classification, requested/provider-returned model, prompt/schema versions, provider request ID when available, latency, input/output SHA-256, and `providerStorageRequested:false`. Responses are rejected unless the strict schema and evidence references validate. These hashes support integrity/comparison but do not prove that the underlying content was true or that a provider call succeeded.

For Scan Return specifically:

- label output is limited to nullable routing identifiers, confidence, and exactly one source-bound evidence ID; arbitrary raw label text is neither accepted nor returned, and the identifiers must still resolve through exact DynamoDB aliases;
- image label confidence below `0.75` selects no record, and identifiers that point to different records fail closed instead of choosing whichever alias was checked first;
- package output is limited to visible-item observations, candidate SKU, quantity, condition, serials, comparison fields, uncertainty, classification, missing evidence, and supplied evidence references;
- a non-`INCONCLUSIVE` classification below `0.65` confidence is downgraded to `INCONCLUSIVE`;
- the model never supplies refund cents. The return record separately carries requested refund cents, currency, policy ID/version, and a verified policy-snapshot SHA-256. Full and quantity-based partial amounts derive from catalog values but are capped at the lower of requested and eligible totals; empty/wrong/possible-imitation findings produce a temporary hold under the same cap; damaged/inconclusive findings produce no monetary recommendation;
- possible imitation is a routing signal for qualified authentication, never a photographic counterfeit determination.

## Human decision and appeal

Final adverse action requires:

- authorized reviewer role;
- merchant and policy version;
- supported reason code;
- exact evidence IDs and timestamps;
- explanation that avoids unsupported intent claims;
- decision and contest deadline;
- alternate/appeal route;
- correction and settlement path if overturned.

A case can be defaulted after a deadline only when applicable merchant terms and notices allow it; default does not convert uncertainty into a fraud label. Compensation to a merchant depends on actual protection/commercial terms, not the model decision.

Generated shopper communications remain `DRAFT_NOT_SENT` and show the original catalog reference and warehouse image as separately labeled provenance. Generated prose must semantically match the deterministic refund state and cannot claim approval, denial, fraud, authenticity, invented contact details, deadlines, or unrecognized amounts; otherwise the server uses a bounded template. Before queueing, the server requires a session-scoped `APPROVE_AS_WRITTEN` review bound to the exact draft-content SHA-256, inspection, return record, and complete evidence set. Queueing recomputes the send-relevant content hash from the stored draft, compares it with both draft and review, and stores the same hash in the outbox record. The review's display label is explicitly unauthenticated; production requires SSO/RBAC. The only queue implemented is idempotent `QUEUED_TEST_OUTBOX` storage with `deliveryDisabled:true`; no email, SMS, refund, customer-contact, or processor side effect is wired.

## Retention and deletion

| Record | Product expiry target | Storage behavior |
|---|---:|---|
| anonymous session/case fixture events | 24 hours | DynamoDB TTL plus API expiry check |
| completed intake evidence, inspection, draft, operator review, test-outbox metadata | 24 hours | session-scoped DynamoDB records with TTL plus API expiry checks where read |
| optional upload object version | 24 hours | versioned S3, 60-second presigned POST/fresh five-minute version-scoped read URL, current/noncurrent S3 Lifecycle |
| seeded synthetic return profiles and exact aliases | release/demo lifetime | retained return-lookup table; no real shopper data; separately approved cleanup |
| waitlist record | 30 days from first accepted submission | DynamoDB TTL; duplicate submission returns existing without extending retention |
| CloudWatch logs | 7 days | explicit log group retention |
| static web/fixtures | release lifetime | versioned retained bucket |

DynamoDB TTL and S3 Lifecycle deletion are asynchronous. “24 hours” is the access/product expiry; physical deletion may complete later. A production deletion SLA must be verified and monitored.

The upload form is a bearer capability for its 60-second lifetime. Although its signed conditions prevent changing the key, bytes, type, checksum, purpose, or metadata, a bearer can replay it during that window. The demo enforces 12 issued policies per session and 120 per UTC day, separately from the 30/session and 250/day model-evaluation budgets. It still needs single-use issuance records, authenticated tenant byte budgets, storage alarms, and WAF/anomaly controls before production merchant uploads.

## Logging and monitoring

Allowed operational log fields include request ID, route, anonymous session hash, case ID, checkpoint, result class, latency, model/version, token/cost counters, error class, and status code. Logs exclude evidence text/images, email, address, identity result details, signed URLs, secret values, and raw model prompts/responses.

CloudWatch alarms cover Lambda errors, throttles, and sustained p95 latency. A production service needs notification routing, dashboards, SLO/error budget, provider-status monitoring, and a kill switch that disables model calls or enforcement independently.

## Incident response sketch

1. disable affected upload/model/integration feature flag;
2. preserve redacted logs, request IDs, versions, and affected case references;
3. rotate secret if exposure is possible;
4. identify tenant/data/time scope without broad exports;
5. stop automated enforcement and route cases to human review;
6. notify security/privacy/legal and merchants under the approved plan;
7. correct shopper/merchant outcomes and accounting;
8. add regression/monitoring before re-enable.

## Production review checklist

- security architecture and threat-model sign-off;
- privacy/data protection impact assessment;
- vendor/subprocessor and model data-use review;
- merchant configuration and notice approval;
- authentication, tenant RBAC, and penetration testing;
- accessibility testing of every challenge/appeal route;
- retention/deletion and data-subject workflow test;
- model evaluation, bias/friction review, and enforcement gate;
- processor/Reclaim authorization and submission audit;
- production email/SMS sender authorization, template/consent/opt-out controls, and delivery-state reconciliation;
- production OAuth/resource-server authentication, Redo tenant RBAC, official-client interoperability tests, and an independent conformance/security review before externally exposing the stateless MCP Streamable HTTP integration;
- incident/on-call and rollback rehearsal.
