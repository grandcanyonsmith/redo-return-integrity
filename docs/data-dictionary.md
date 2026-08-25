# Data dictionary and operational schema

Canonical runtime validation lives in `packages/domain/src`. This document explains the contract and DynamoDB projection. All monetary values are integer minor units; all displayed dollar scenarios declare currency and denominator.

## Time semantics

| Field | Meaning |
|---|---|
| `observedAt` | when the source says the event or observation occurred |
| `receivedAt` | when Return Integrity received it |
| `availableAt` | earliest time a decision was allowed to use it after validation/processing |
| `evaluatedAt` / `snapshotAt` | decision's point-in-time boundary |
| `expiresAt` | ISO product-access expiry used by application logic |
| `ttl` | epoch seconds used by DynamoDB background cleanup |

An artifact is eligible only when its lifecycle checkpoint is no later than the evaluated checkpoint, `availableAt <= evaluatedAt`, `receivedAt <= evaluatedAt`, and it is not expired. `observedAt` alone never makes late-arriving data available to an earlier model replay.

## Main DynamoDB table

Primary key: `PK` string + `SK` string. Billing: on-demand. TTL: `ttl`. Point-in-time recovery enabled. Removal policy: retain.

| Entity | `PK` | `SK` | Important attributes | Access pattern |
|---|---|---|---|---|
| session | `SESSION#{sessionId}` | `META` | `entity`, `sessionId`, `createdAt`, `expiresAt`, `evaluationCount`, `uploadUrlCount`, `ttl` | validate capability and per-session model/upload limits |
| case projection | `SESSION#{sessionId}` | `CASE#{caseId}` | `entity`, `caseData`, `ttl` | list/get current cases in one session |
| case event | `SESSION#{sessionId}` | `EVENT#{occurredAt}#{eventId}` | `entity`, `event`, `ttl` | append/query ordered audit timeline |
| daily model counter | `RATE#{yyyy-mm-dd}` | `MODEL_EVALUATIONS` | `evaluationCount`, `ttl` | transactional 250/day guard |
| daily upload-policy counter | `RATE#{yyyy-mm-dd}` | `UPLOAD_URLS` | `uploadUrlCount`, `ttl` | transactional 120/day presign guard |

Session and day counters are acquired in the same DynamoDB transaction to avoid overspending under concurrency. Session creation transacts the session and synthetic fixture case projections.

The prototype stores a complete `caseData` projection for simple reads. Production should normalize large evidence/decision records or archive artifacts before approaching DynamoDB's item-size limit, while retaining the same public domain contract.

## Return-intake DynamoDB table

The dedicated return-intake table is on-demand, point-in-time-recoverable, and retained. It has two bounded key families:

| Entity | `PK` | `SK` | Important attributes |
|---|---|---|---|
| synthetic return profile | `RETURN#{returnRecordId}` | `PROFILE` | merchant/order/customer, one expected item, explicit return request, refund-policy snapshot |
| exact alias pointer | `LOOKUP#{LABEL\|RMA\|ORDER\|TRACKING}#{normalizedValue}` | `POINTER` | `returnRecordId`, synthetic marker |
| completed evidence | `SESSION#{sessionId}` | `EVIDENCE#{evidenceId}` | exact purpose, object key, immutable S3 version, MIME, bytes, SHA-256, verified/expiry times |
| package inspection | `SESSION#{sessionId}` | `INSPECTION#{inspectionId}` | evidence-bound finding, deterministic recommendation, `modelAudit`, TTL |
| communication draft | `SESSION#{sessionId}` | `DRAFT#{draftId}` | send-relevant content, attachments, `contentSha256`, `modelAudit`, `DRAFT_NOT_SENT`, TTL |
| operator review | `SESSION#{sessionId}` | `REVIEW#{reviewId}` | exact return/inspection/draft/evidence binding, `APPROVE_AS_WRITTEN`, `draftContentSha256`, acknowledgments, TTL |
| test outbox | `SESSION#{sessionId}` | `OUTBOX#DRAFT#{draftId}` | review ID, `draftContentSha256`, `QUEUED_TEST_OUTBOX`, `deliveryDisabled:true`, TTL |

The five seeded profiles and twenty alias pointers are globally keyed fictional `example.test` demo data. The anonymous session gates later evidence/inspection/draft/review/outbox records, but it does not tenant-scope profile lookup: a caller that knows a seeded alias can resolve the corresponding synthetic profile. That is acceptable only because every profile is synthetic. Before real merchant data, use authenticated Redo tenant identity, tenant-prefixed return/alias keys, role authorization, and tenant binding on every downstream intake object.

### Return request and policy provenance

The public `ReturnRecord.return` contract contains `reason`, `requestedRefundCents`, three-letter `currency`, `policyId`, `policyVersion`, `policySnapshotSha256`, and status. `requestedRefundCents` is not inferred from catalog value. The storage adapter reconstructs a canonical allowlisted policy snapshot, verifies its SHA-256, and currently fails closed unless the record is one USD return line whose requested amount does not exceed the policy maximum and whose policy enables quantity proration and human approval. Refund math is capped at the lower of requested amount and eligible catalog total.

### Intake evidence and model/draft audit

`CompletedIntakeEvidence.purpose` is exactly `RETURN_LABEL` or `PACKAGE_CONTENTS`. The label tool requires the former and the package/draft path requires the latter. Nonfixture model calls accept only a completed, same-session evidence ID; there is no inline image field. The stable record stores the S3 object key and version ID, while fresh exact-version read URLs expire after 300 seconds and are never persisted as evidence.

`IntakeModelAudit` contains `provider`, `requestedModel`, nullable `providerModel`, `promptVersion`, `schemaName`, nullable provider `requestId`, `latencyMs`, `inputSha256`, nullable `outputSha256`, and literal `providerStorageRequested:false`. Both `PackageInspection` and `CommunicationDraft` carry this record. A draft's `contentSha256` covers the send-relevant channel, recipient, subject, body, and attachment role/source/evidence/provenance fields. `OperatorReviewRecord` copies that hash and can record only `draftDecision:"APPROVE_AS_WRITTEN"`; queueing recomputes the stored draft hash and requires equality among the draft, review, and test-outbox message.

## Waitlist DynamoDB table

Primary key: `emailHash` string. Billing: on-demand. TTL: `ttl`. Point-in-time recovery enabled. Removal policy: retain. There is no public list/read route.

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `emailHash` | string | yes | SHA-256 of normalized email; dedupe partition key |
| `email` | string | yes | consented contact email; never placed in operational logs |
| `role` | string | yes | buyer/research context selected by submitter |
| `companyUrl` | string | no | optional company context, validated as URL |
| `consent` | literal `true` | yes | affirmative permission to retain/contact under the notice |
| `noticeVersion` | string | yes | exact notice accepted |
| `submittedAt` | ISO string | yes | first accepted submission time for the deduped record |
| `expiresAt` | ISO string | yes | product expiry target, 30 days |
| `ttl` | integer | yes | DynamoDB expiry in epoch seconds |

Duplicate submission returns an idempotent result; it does not send an email. A production controller workflow must define access, deletion, and export.

The public notice must say: “30-day active-retention target; AWS TTL deletion and retained backups may lag per policy.”

`emailHash` is a lookup/dedupe key, not anonymization: email has a small, guessable domain and the opted-in plaintext email is intentionally retained for follow-up. Production should use a managed secret pepper/HMAC and protect the table as contact data.

## `EvidenceArtifact`

| Field | Type | Purpose |
|---|---|---|
| `evidenceId` | string | immutable ID cited by rules/model/human |
| `caseId` | string | owning case |
| `checkpointId` | enum | lifecycle point that generated the artifact |
| `sourceSystem` | string | native producer/simulator |
| `provenanceTier` | `E0`–`E5` | support quality, never intent |
| `observedAt` | ISO datetime | native event time |
| `availableAt` | ISO datetime | decision availability boundary |
| `receivedAt` | ISO datetime | ingestion time |
| `facts` | string-keyed JSON | typed-by-convention native facts |
| `objectKey` | string? | private S3 object reference, not public URL |
| `fixtureUrl` | string? | safe synthetic fixture location |
| `checksum` | string? | integrity digest where available |
| `protocolVersion` | string | capture/adapter contract version |
| `piiClass` | enum | `NONE`, `PSEUDONYMOUS`, `PERSONAL`, `SENSITIVE` |
| `useScope` | enum[] | `RISK_DECISION`, `CUSTOMER_SUPPORT`, `DISPUTE_EVIDENCE`, `MODEL_EVALUATION`, `ANALYTICS` |
| `expiresAt` | ISO datetime? | artifact product expiry |

### Provenance tiers

| Tier | Contract meaning |
|---|---|
| `E0` | unverified assertion or self-reported information |
| `E1` | captured metadata with known provenance |
| `E2` | system-observed first-party event |
| `E3` | independent carrier/payment/partner corroboration |
| `E4` | protocol-controlled physical inspection/measurement |
| `E5` | adjudicated outcome or confirmed settlement/loss/recovery |

## Representative fact keys

Facts remain source-specific JSON, but policy and rules depend on a reviewed catalog. These are representative, not exhaustive.

| Checkpoint group | Fact keys |
|---|---|
| visit/identity | `sessionVelocity`, `botChallengeOutcome`, `accountAgeDays`, `verifiedChannelResult`, `identityVerificationOutcome`, `entityLinkConfidence` |
| checkout/order | `orderAmountCents`, `currency`, `cartQuantity`, `paymentAuthorizationResult`, `avsResult`, `threeDsResult`, `billingShippingDistanceKm`, `orderEditAfterAuthorization` |
| outbound | `expectedSku`, `expectedQuantity`, `expectedWeightGrams`, `outboundWeightGrams`, `weightToleranceGrams`, `serialExpected`, `sealId`, `scaleCalibrationId` |
| delivery/return | `deliveryStatus`, `deliveryTimestamp`, `requestedSku`, `requestedQuantity`, `returnReasonCode`, `policyWindowEligible`, `requestedResolution` |
| reverse logistics | `rmaId`, `trackingId`, `dropoffTimestamp`, `dropoffLocation`, `carrierScanSequence`, `returnWeightGrams`, `routeDistanceKm`, `elapsedMinutes`, `carrierException` |
| receipt/inspection | `receivedWeightGrams`, `sealCondition`, `observedSku`, `observedQuantity`, `serialObserved`, `contentsState`, `protocolComplete`, `operatorAgreement` |
| settlement/appeal | `eligibleRefundCents`, `approvedRefundCents`, `refundProcessorState`, `appealOutcome`, `disputeId`, `evidencePacketState`, `recoveredCents`, `protectionPayoutCents` |

Any field with `email`, `phone`, `fullName`, street/address line, government ID, passport, driver's license, or raw ID semantics is redacted before the model call. Production must move from regex defense-in-depth to a strict per-checkpoint allowlist.

## `DeterministicSignal`

| Field | Type | Meaning |
|---|---|---|
| `code` / `label` | string | stable machine code + UI name |
| `status` | `OBSERVED`, `NOT_OBSERVED`, `UNKNOWN` | three-state evaluation |
| `severity` | `INFO`, `LOW`, `MEDIUM`, `HIGH` | routing priority, not fraud probability |
| `riskBearing` | boolean | can contribute to bounded risk policy |
| `explanation` | string | deterministic explanation |
| `evidenceIds` | string[] | exact supporting artifacts |
| `value`, `threshold`, `unit` | optional | auditable numeric comparison |

## `OpenAIAssessment`

| Field | Contract |
|---|---|
| `status` | `PASS`, `CONCERN`, `INCONCLUSIVE`, or local `ERROR` fallback |
| `confidence` | 0–1 model confidence; not calibrated fraud probability unless proven |
| `summary` | bounded explanation |
| `riskIndicators` | code/explanation/evidence IDs |
| `exculpatoryIndicators` | supported alternative facts |
| `missingInformation` | precise missing evidence |
| `recommendedDisposition` | `PASS`, `PASS_MONITORED`, `REQUEST_EVIDENCE`, `HUMAN_REVIEW` |
| `imageFindings` | evidence-bound package/content/label/serial observations |

Output is rejected when schema-invalid or when any cited evidence ID is outside the snapshot.

## `CheckpointDecision`

| Group | Fields |
|---|---|
| identity/time | `decisionId`, `caseId`, `checkpointId`, `evaluatedAt` |
| inputs | `evidenceSnapshot`, `nativeFacts`, `deterministicSignals` |
| recommendation/policy | `openAIAssessment`, `merchantPolicyResult` |
| accountability | optional `humanDecision`, `accountableFinalAction` |
| continuation | `shopperCure`, `nextState`, optional `deadlineAt` |
| reproducibility | `modelVersion`, `promptVersion`, `schemaVersion`, `policyVersion`, `highestEvidenceTier`, `simulated` |

`PolicyResult.action` explicitly excludes `DENY` and `OVERTURN`. When `accountableFinalAction.action` is `DENY`, the actor must be `HUMAN_OPERATOR` and a matching `HumanDecision` must exist.

## `CaseActionEvent`

Append-only fields: `eventId`, `caseId`, `occurredAt`, actor, action, target, rationale, evidence IDs, prior/next state, and optional `supersedesDecisionId`. Appeals must reference the decision they contest. Deny, partial approve, and overturn require a human actor.

## Enumerations

### Checkpoints

`VISIT_SESSION`, `IDENTITY_LINK`, `CHECKOUT_PAYMENT`, `ORDER_RELEASE`, `OUTBOUND_PACK`, `OUTBOUND_CUSTODY`, `DELIVERY_POSSESSION`, `RETURN_REQUEST`, `RETURN_AUTHORIZATION`, `REVERSE_HANDOFF`, `REVERSE_TRANSIT`, `WAREHOUSE_RECEIPT`, `ITEM_INSPECTION`, `REFUND_SETTLEMENT`, `CONTEST_APPEAL_RECOVERY`.

### Decision actions

`PASS`, `PASS_MONITORED`, `CHALLENGE`, `REQUEST_EVIDENCE`, `HOLD`, `HUMAN_REVIEW`, `APPROVE`, `PARTIAL_APPROVE`, `DENY`, `OVERTURN`, `CLOSE`.

### Targets

`CHECKOUT`, `ORDER`, `RETURN_AUTHORIZATION`, `REFUND`, `APPEAL`, `PAYMENT_CASE`.

### Case state

`ACTIVE`, `AWAITING_SHOPPER`, `AWAITING_MERCHANT`, `REFUND_HELD`, `APPROVED`, `PARTIAL_REFUND`, `DENIED`, `APPEALED`, `OVERTURNED`, `CLOSED`.

## Analytics schema cautions

- `RevenueCohort` identifiers retain the supplied `$80M`/`$200M` scenario labels, but fields are described as annual merchant GMV only as a planning assumption. Finance must replace or rename them when definitions are known.
- `observationId` must be unique before money aggregation.
- `groundTruthVerified=false` excludes a record from verified-loss-stopped aggregation.
- `challengeCompleted=false` is counted as legitimate friction only when the shopper is independently known legitimate; it is never fraud.
- protection payouts require a separate field/state before production analytics; they must not be placed in `actualRecoveryCents` unless accounting explicitly defines and reports that mapping.
