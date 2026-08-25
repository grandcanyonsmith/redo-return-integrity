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

- Juniper Circuit, its shoppers, orders, tracking events, payment results, warehouse images, and disputes are fictional/synthetic.
- Users are told not to upload a government ID, face, real shipping label, or another person's personal data.
- A scaffold may issue short-lived presigned URLs for declared JPEG/PNG/WebP up to 5 MB. It explicitly marks the object “not evidence”; demonstrated assessments use curated synthetic fixtures.
- Upload finalization, server magic-byte/checksum verification, and enforced browser metadata removal are production gates. Until they exist, a presigned object must not enter a decision or model request.
- OpenAI requests use `store: false` and the minimum checkpoint evidence.
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

Before real merchant data:

- integrate Redo staff and merchant SSO;
- enforce server-side tenant/role checks on every object;
- separate shopper, operator, merchant reviewer, support, and administrator permissions;
- require step-up for final denial, export, retention override, and integration submission;
- test horizontal/vertical authorization and signed-URL scoping.

## Threat model

| Threat | Control in prototype | Production follow-up |
|---|---|---|
| secret exposure | Secrets Manager reference; server fetch; secret scans; no browser key | rotation, access alert, scoped environment/account |
| direct S3 read | Block Public Access + CloudFront OAC | access-log review, WAF/signed delivery if needed |
| upload malware/polyglot | allowlist, size/magic-byte validation, no execution | quarantine, malware scan, content disarm where appropriate |
| prompt injection in image/text | evidence is data; fixed system/schema; no tools or action authority | adversarial regression suite and red-team review |
| cross-session access | random session, server relationship checks, private buckets | authenticated tenant RBAC and authorization tests |
| model exfiltration/overcollection | minimum fields, `store:false`, no raw ID/PAN/IP | vendor/data-flow review, field-level allowlists |
| denial of service/cost abuse | API throttle, 30/session, 250/day, upload cap | WAF, tenant budgets, anomaly alert, queue/backpressure |
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

Each request includes model, prompt, and response-schema versions; a hashed safety identifier; `store:false`; and only the evidence allowed for that checkpoint. Responses are rejected unless the strict schema and evidence references validate.

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

## Retention and deletion

| Record | Product expiry target | Storage behavior |
|---|---:|---|
| anonymous session/case fixture events | 24 hours | DynamoDB TTL plus API expiry check |
| optional upload | 24 hours | signed URL expiry plus S3 Lifecycle |
| waitlist record | 30 days from first accepted submission | DynamoDB TTL; duplicate submission returns existing without extending retention |
| CloudWatch logs | 7 days | explicit log group retention |
| static web/fixtures | release lifetime | versioned retained bucket |

DynamoDB TTL and S3 Lifecycle deletion are asynchronous. “24 hours” is the access/product expiry; physical deletion may complete later. A production deletion SLA must be verified and monitored.

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
- incident/on-call and rollback rehearsal.
