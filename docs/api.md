# HTTP API contract

Version: prototype `v0.1`. Public base path: `/api`. The CloudFront behavior is uncached. JSON is UTF-8. The only non-JSON success body is the explicitly documented finite SSE response on the MCP SDK's 2025-era stateless compatibility leg. The current UI can fall back to local synthetic decisions when the API is unavailable; fallback is visibly labeled and never described as a live OpenAI result.

## Session capability

Production merchant auth is out of scope. The demo uses a random, 24-hour session capability. Preferred transport after creation:

```http
x-demo-session: 575f…
```

The browser also receives an `HttpOnly; Secure; SameSite=Strict` cookie. It currently sends the session header for explicitness. Session IDs must not appear in logs or analytics except as a one-way hash.

## Common response and errors

Success responses are JSON unless the MCP compatibility behavior below says otherwise. Errors use:

```json
{
  "error": {
    "code": "SESSION_EVALUATION_LIMIT",
    "message": "This demo session has used its 30 live assessments.",
    "requestId": "…",
    "retryable": false
  }
}
```

| Status | Meaning |
|---:|---|
| `400` | invalid schema/content type/magic byte/checkpoint transition |
| `401` | missing, unknown, or expired demo session |
| `403` | session does not own case/evidence, completed evidence has the wrong intake purpose, or role cannot perform action |
| `404` | object not found in authorized scope |
| `409` | idempotency/state/version conflict |
| `400` | prototype upload declaration exceeds 5 MiB (5,242,880 bytes) or is not JPEG/PNG/WebP; production should specialize this to `413`/`415` |
| `422` | valid JSON but unsupported action/evidence state |
| `429` | per-session/daily model or upload-policy limit, or API throttle |
| `503` | required provider unavailable; no adverse state change |

## Routes

### `GET /api/health`

Unauthenticated operational probe. It does not call OpenAI or expose infrastructure names.

```json
{
  "ok": true,
  "service": "redo-return-integrity-api",
  "model": "gpt-5.6-terra",
  "openAIConfigured": true,
  "persistence": "dynamodb",
  "returnLookupPersistence": "dynamodb",
  "intakeUploadCompletion": true,
  "mcpSurface": "official-sdk-stateless-streamable-http",
  "mcpProtocolVersion": "2026-07-28",
  "mcpSessions": false,
  "mcpResponseMode": "terminal-json",
  "policy": "human-final-adverse-decisions"
}
```

`openAIConfigured=true` means a key reference exists; it does not prove provider billing, model entitlement, or a successful model call. A model/provider/schema failure is returned through the intake contracts as `SAFE_FALLBACK` and cannot cause an adverse action.

### `POST /api/sessions`

Creates one isolated session and seeds the three synthetic cases.

Response `201`:

```json
{
  "session": {
    "sessionId": "575f4430-…",
    "createdAt": "2026-08-24T18:00:00.000Z",
    "expiresAt": "2026-08-25T18:00:00.000Z",
    "evaluationCount": 0
  },
  "sessionToken": "575f4430-…",
  "privacy": "Synthetic fixture data expires after 24 hours…"
}
```

### `GET /api/session`

Returns the authorized session's expiry and usage; never returns another session.

### `POST /api/session/reset`

Restores synthetic fixture cases and resets the session evaluation count. It does not affect waitlist records or other visitors. A production contract should add explicit idempotency/version control; the prototype does not accept an idempotency key.

### `GET /api/cases`

Returns case summaries for the session. Query filters, if added, are allowlisted and bounded; there is no cross-session scan.

### `GET /api/cases/{caseId}`

Returns the case projection, evidence metadata, immutable decisions, actions, and current state. Private object keys are not returned as public URLs.

### `POST /api/cases/{caseId}/checkpoints/{checkpointId}/evaluate`

Acquires one evaluation budget slot and evaluates only point-in-time eligible evidence. A compatibility request may carry the visible simulator summary, but the server uses case evidence as authority.

```json
{
  "evaluatedAt": "2026-08-24T18:02:00.000Z",
  "simulate": false,
  "imageUrls": []
}
```

Response `200` includes the full decision contract. The current presentation adapter also exposes a compact view:

```json
{
  "caseId": "physical-return-001",
  "checkpointId": "ITEM_INSPECTION",
  "recommendation": "HUMAN_REVIEW",
  "summary": "The returned parcel evidence is materially inconsistent with the authorized quantity; shopper explanation and accountable review are required.",
  "confidence": 0.88,
  "evidenceIds": ["ev-receipt-weight", "ev-opening-view"],
  "missingEvidence": ["Shopper explanation", "Second inspection"],
  "mode": "live",
  "decision": {
    "decisionId": "…",
    "evidenceSnapshot": [],
    "deterministicSignals": [],
    "openAIAssessment": {},
    "merchantPolicyResult": {},
    "accountableFinalAction": {},
    "shopperCure": [],
    "nextState": "AWAITING_MERCHANT",
    "modelVersion": "gpt-5.6-terra",
    "promptVersion": "return-integrity-evidence-review-1.0",
    "schemaVersion": "checkpoint-decision-1.0",
    "simulated": false
  }
}
```

Rules:

- `evaluatedAt` cannot be used to reach future evidence or backdate newly available evidence.
- An OpenAI/API/schema/reference failure returns a decision with local `ERROR`/`HUMAN_REVIEW`, not denial.
- `mode=live` means the live server path returned; model `simulated` and model request status remain separate fields.
- 30 evaluations/session and 250/day are transactional server limits.

### `POST /api/cases/{caseId}/actions`

Appends an accountable action. `DENY`, `PARTIAL_APPROVE`, and `OVERTURN` require authorized `HUMAN_OPERATOR` role in production. The public demo can simulate the UI but must label that no real merchant/refund action occurred.

```json
{
  "decisionId": "…",
  "actor": "HUMAN_OPERATOR",
  "action": "REQUEST_EVIDENCE",
  "target": "REFUND",
  "rationale": "A second calibrated weight and shopper explanation can resolve the discrepancy.",
  "evidenceIds": ["ev-receipt-weight"],
  "supersedesDecisionId": "optional-prior-decision-id"
}
```

For an appeal, `supersedesDecisionId` is required. Old decisions remain retrievable.

### `POST /api/cases/{caseId}/uploads`

Creates a 60-second presigned S3 POST after validating requested media type, declared size, and SHA-256. The signed form policy fixes the object to the declared byte length, MIME type, checksum, and metadata. Allowed: `image/jpeg`, `image/png`, `image/webp`; maximum 5 MiB (5,242,880 bytes). Real government ID, face capture, and real labels are prohibited by the demo notice.

```json
{
  "checkpointId": "REVERSE_HANDOFF",
  "mimeType": "image/webp",
  "sizeBytes": 481234,
  "sha256": "64-lowercase-or-uppercase-hex-characters"
}
```

Response contains a 60-second `uploadUrl`, an opaque random `ephemeral/case-evidence/{uuid}.{ext}` object key, all required `formFields`, and explicit `UPLOAD_URL_ISSUED_NOT_EVIDENCE` state. The client must submit those fields unchanged in `multipart/form-data`, with the image in the `file` part. This older case-scoped contract does not have a matching case-evidence finalizer. It is separate from the completed return-intake upload contract below; callers must not pass a case-scoped object key to `/api/uploads/complete`.

### `GET /api/cases/{caseId}/evidence/{evidenceId}`

Returns metadata plus a very short-lived authorized read URL only when the session owns the case and artifact is unexpired. Response uses `Cache-Control: no-store`.

## Return-intake routes

These routes power the merchant/warehouse `/intake` workflow. They use the same 24-hour demo session capability. Synthetic return profiles are resolved from the dedicated return-lookup table; completed evidence, inspections, drafts, and test-outbox messages are stored under the authorized session.

### `POST /api/uploads/presign`

Creates a 60-second presigned S3 POST contract for a label or package-content image. The request must declare the exact bytes that will be uploaded:

```json
{
  "purpose": "PACKAGE_CONTENTS",
  "mimeType": "image/png",
  "sizeBytes": 481234,
  "sha256": "64-lowercase-or-uppercase-hex-characters"
}
```

`purpose` is `RETURN_LABEL` or `PACKAGE_CONTENTS`. JPEG, PNG, and WebP are accepted up to 5 MiB. A configured deployment responds `201` with:

```json
{
  "status": "UPLOAD_URL_ISSUED_NOT_EVIDENCE",
  "uploadUrl": "short-lived-presigned-URL",
  "objectKey": "ephemeral/intake-package-contents/{uuid}.png",
  "formFields": {
    "key": "ephemeral/intake-package-contents/{uuid}.png",
    "Content-Type": "image/png",
    "x-amz-checksum-algorithm": "SHA256",
    "x-amz-checksum-sha256": "base64-encoded-sha256",
    "x-amz-meta-expectedsha256": "…",
    "x-amz-meta-expectedsizebytes": "481234",
    "x-amz-meta-sessionbinding": "one-way-domain-separated-sha256",
    "x-amz-meta-synthetic": "false",
    "x-amz-meta-purpose": "PACKAGE_CONTENTS",
    "success_action_status": "201",
    "Policy": "…",
    "X-Amz-Signature": "…"
  },
  "expiresInSeconds": 60,
  "retentionHours": 24
}
```

`formFields` is abbreviated above; it also contains the AWS credential/date fields generated for that request. The client must append every returned field unchanged to `FormData`, append the image as `file`, and POST the form to `uploadUrl`. It must not replace the multipart `Content-Type` header. The policy enforces an exact `content-length-range` from the declared `sizeBytes`, as well as equality conditions for MIME type, SHA-256 checksum, purpose, one-way session binding, and metadata. S3 returns `x-amz-version-id`, exposed by bucket CORS, and the client must treat a missing or `null` version as a failed upload. The random purpose-scoped key and S3 metadata never contain the raw session capability. This presign response is not evidence and cannot be passed to a model until completion succeeds. When S3 uploads are not configured, the endpoint returns an explicit `UPLOAD_DISABLED` response and points the UI to synthetic fixtures.

### `POST /api/uploads/complete`

Validates a previously uploaded intake object and converts it to session-scoped completed-evidence metadata:

```json
{
  "purpose": "PACKAGE_CONTENTS",
  "objectKey": "ephemeral/intake-package-contents/{uuid}.png",
  "versionId": "S3-version-id-returned-by-the-upload-POST",
  "sha256": "64-lowercase-hex-characters"
}
```

Before returning success, the server verifies:

- the opaque key is under the declared-purpose prefix and does not contain a raw session ID;
- `versionId` is present and both S3 `HEAD` and `GET` resolve that exact immutable version;
- S3 metadata carries the current session's one-way binding, purpose, expected size, and expected SHA-256;
- the S3 SHA-256 checksum, actual object size, and content type satisfy the signed declaration and 5 MiB JPEG/PNG/WebP allowlist;
- bytes begin with the declared PNG, JPEG, or WebP signature;
- SHA-256 of the downloaded bytes exactly matches the declaration.

Response `201`:

```json
{
  "status": "VERIFIED_INTAKE_EVIDENCE",
  "evidence": {
    "evidenceId": "ev-upload-…",
    "sessionId": "…",
    "purpose": "PACKAGE_CONTENTS",
    "objectKey": "ephemeral/…",
    "versionId": "S3-version-id",
    "mimeType": "image/png",
    "sizeBytes": 481234,
    "sha256": "…",
    "verifiedAt": "2026-08-24T18:05:00.000Z",
    "expiresAt": "2026-08-25T18:05:00.000Z"
  },
  "previewUrl": "fresh-five-minute-read-URL-for-the-exact-version",
  "expiresInSeconds": 300
}
```

Completion establishes file/session integrity for this demo workflow. The stable evidence record stores `objectKey`, `versionId`, and its immutable `purpose`, never the expiring `previewUrl`; later authorized uses mint a fresh five-minute URL scoped to that exact version. The 300-second value above is the read-preview lifetime, not the upload authorization: the presigned POST expires after 60 seconds. The first completion is conditionally persisted, and a replay for the same key/version returns the original `verifiedAt`/`expiresAt` record rather than rewriting provenance. Completion is not malware scanning, qualified authenticity review, or a legal chain-of-custody certification.

The presigned form is a 60-second bearer capability. During that window it can be replayed, although any replay remains constrained to the same random key, exact bytes, MIME type, checksum, purpose, and metadata and creates a separately identified S3 version. The demo atomically limits issuance to 12 policies per session and 120 per UTC day. It does not yet persist a single-use issuance record or enforce authenticated tenant byte budgets; production must add those controls before accepting merchant data.

### `POST /api/intake/label-lookup`

Extracts return-routing identifiers from a label image and performs exact DynamoDB alias lookup. The request accepts exactly one source:

- completed-upload `evidenceId` whose recorded purpose is exactly `RETURN_LABEL`;
- synthetic `fixtureId: "labelRma8821"`;
- `scanValue` or explicit `labelId`, `rmaId`, `orderId`, or `trackingNumber` for scanner/manual entry.

There is no inline-image input field. A nonfixture label image must complete `/api/uploads/complete` before this route can consume its evidence ID; a completed `PACKAGE_CONTENTS` ID is rejected with `403 EVIDENCE_PURPOSE_MISMATCH`.

Example fixture request:

```json
{ "fixtureId": "labelRma8821" }
```

The response never treats model text as an authorization decision. Abbreviated example (the full `returnRecord` also carries customer, product, and return-policy fields):

```json
{
  "mode": "SYNTHETIC_FIXTURE",
  "extraction": {
    "labelId": "LBL-8821",
    "trackingNumber": "1Z-REDO-8821",
    "rmaId": "RMA-8821",
    "orderId": "JC-1042",
    "carrier": "UPS",
    "confidence": 1,
    "evidenceIds": ["ev-label-…"]
  },
  "returnRecord": {
    "returnRecordId": "ret-jc-1042",
    "merchantId": "juniper-circuit-demo",
    "merchantName": "Juniper Circuit",
    "labelId": "LBL-8821",
    "rmaId": "RMA-8821",
    "orderId": "JC-1042",
    "trackingNumber": "1Z-REDO-8821",
    "product": {
      "sku": "JC-ARC-ONE-KIT",
      "quantity": 2,
      "unitPriceCents": 92450,
      "totalEligibleRefundCents": 184900
    },
    "return": {
      "requestedRefundCents": 184900,
      "currency": "USD",
      "policyId": "juniper-return-policy",
      "policyVersion": "2026-08-24.v1",
      "policySnapshotSha256": "92fe5169bc20d5bd60814c9cddd6384586c85ba7b8f119e6cc787c8d449e4da6",
      "status": "INSPECTION_PENDING"
    }
  },
  "matchedBy": "LABEL",
  "warnings": []
}
```

`mode` is `OPENAI`, `SYNTHETIC_FIXTURE`, `DIRECT_IDENTIFIERS`, or `SAFE_FALLBACK`. Label extraction uses a strict schema, returns exactly one source-bound evidence ID, omits arbitrary raw-label text, and may return null routing fields; it never invents a record. An image extraction below `0.75` confidence produces `SAFE_FALLBACK`, selects no return record, and asks for manual confirmation. The lookup queries normalized aliases (`LABEL`, `RMA`, `ORDER`, `TRACKING`) without a table scan. If supplied/extracted identifiers resolve to more than one return record, it fails closed with `returnRecord:null` and a conflict warning rather than choosing the first. No match likewise returns `returnRecord:null` plus a warning.

The returned `return` object makes the requested amount and currency distinct from catalog eligibility and binds the calculation to an explicit policy ID, policy version, and verified canonical policy-snapshot SHA-256. The current storage adapter fails closed unless the synthetic record is one USD return line, its requested amount is within the policy maximum, the policy enables quantity proration and human approval, and the stored snapshot hash matches the reconstructed allowlisted policy fields. The globally keyed aliases/profiles are public-demo synthetic data; they are not tenant authorization. A production route must bind every alias and record key to the authenticated Redo merchant tenant before exposing real data.

### `POST /api/intake/inspections`

Compares package-content evidence against the looked-up catalog SKU, authorized quantity, serial references, and original product image:

```json
{
  "returnRecordId": "ret-jc-1042",
  "evidenceId": "ev-upload-…"
}
```

For deterministic demonstrations, `fixtureId` can be `matchReturn`, `emptyReturn`, `quantityMismatch`, `wrongItem`, `damagedProduct`, or `possibleImitation`. Nonfixture image analysis requires a completed `evidenceId` whose recorded purpose is exactly `PACKAGE_CONTENTS`; a `RETURN_LABEL` evidence ID is rejected with `403 EVIDENCE_PURPOSE_MISMATCH`. There is no inline-image field in the accepted REST or MCP contract, so arbitrary image data cannot bypass immutable upload provenance. A successful response `201` contains `mode` and an `inspection` with:

- one strict classification: `MATCH`, `EMPTY_BOX`, `DAMAGED_PRODUCT`, `QUANTITY_MISMATCH`, `WRONG_PRODUCT`, `POSSIBLE_IMITATION`, or `INCONCLUSIVE`;
- confidence, summary, observed items, candidate SKU, quantity, condition, serials, evidence references, expected-versus-observed comparison, and missing evidence;
- bounded `nextAction`, refund recommendation, communication recommendation, evidence-image URL, analysis mode, model version, and `modelAudit`.

`modelAudit` records the provider classification (`OPENAI`, `SYNTHETIC_FIXTURE`, or `SAFE_FALLBACK`), requested model, provider-returned model when available, prompt version, schema name, provider request ID when available, latency, SHA-256 hashes of the model input and output, and `providerStorageRequested:false`. These fields make a model result reproducible/auditable without persisting a short-lived signed image URL in the inspection record. A provider failure can legitimately have a null request ID, provider model, or output hash.

The OpenAI response supplies observations and classification—not money or authority. The server rejects unknown evidence references, converts any non-inconclusive result below `0.65` confidence to `INCONCLUSIVE`, and computes refund values deterministically:

| Classification | Server recommendation |
|---|---|
| `MATCH` | full amount, capped at the lower of requested refund and eligible catalog total |
| `QUANTITY_MISMATCH` | observed units × catalog unit price, capped at the lower of requested refund and eligible catalog total |
| `EMPTY_BOX` / `WRONG_PRODUCT` | temporary hold capped at the lower of requested refund and eligible catalog total, pending human review |
| `POSSIBLE_IMITATION` | temporary hold and qualified authentication; image alone cannot establish authenticity |
| `DAMAGED_PRODUCT` | no monetary recommendation until condition/policy review |
| `INCONCLUSIVE` | request clearer evidence; no monetary recommendation |

Every refund object carries `requiresHumanApproval`; the application does not settle, partially refund, withhold, or deny funds.

### `POST /api/intake/communications/draft`

```json
{
  "inspectionId": "…",
  "channel": "EMAIL"
}
```

`channel` is `EMAIL` or `SMS`; SMS requires a phone in the synthetic return record. The server drafts neutral copy from approved record and inspection facts. The result is always `DRAFT_NOT_SENT`, always requires human approval, and includes a provenance manifest for the original catalog image and—when available—the warehouse evidence image. `generationMode` is `OPENAI` or `SAFE_FALLBACK`.

The draft also contains the same `modelAudit` shape described for inspections and a `contentSha256` over its send-relevant channel, recipient, subject, body, and attachment role/source/evidence/provenance fields. Generated prose is checked against the deterministic refund recommendation; claims of fraud, authenticity, approval/denial, invented deadlines/contact details, unknown amounts, or a contradictory full/partial/hold/no-recommendation state cause a bounded `SAFE_FALLBACK` template.

### `POST /api/intake/reviews`

Persists the operator's acknowledgment of the exact inspection, draft, policy recommendation, and complete evidence-ID set before the test outbox can be used:

```json
{
  "inspectionId": "inspection-…",
  "draftId": "draft-…",
  "reviewerLabel": "DEN-04 demo operator",
  "draftDecision": "APPROVE_AS_WRITTEN",
  "acknowledgedRecommendation": true,
  "acknowledgedPolicy": true,
  "acknowledgedEvidence": true,
  "evidenceIds": ["ev-upload-…"]
}
```

The returned review is session-scoped and includes a generated `reviewId`, `reviewedAt`, `reviewerIdentityAssurance:"UNAUTHENTICATED_DISPLAY_LABEL"`, the literal draft decision, and `draftContentSha256` copied from the stored draft. The reviewer label is audit context, not authentication or proof of physical-human identity. The server accepts only `draftDecision:"APPROVE_AS_WRITTEN"`, requires all three literal acknowledgments, and rejects missing evidence or any mismatch among the review, inspection, draft, return record, exact evidence set, content hash, and session.

### `POST /api/intake/communications/queue`

```json
{ "draftId": "…", "reviewId": "…" }
```

Returns `202` with `status:"QUEUED_TEST_OUTBOX"` and `deliveryDisabled:true`. Queueing is rejected unless the review is stored in the same session and is bound to the exact draft, inspection, return record, full inspection evidence set, `APPROVE_AS_WRITTEN` decision, and draft-content SHA-256. Immediately before queueing, the server recomputes the hash from the stored draft and compares it with both the draft and review; the outbox message persists that same hash. It is idempotent per draft and review. There is no SES, SMS, webhook, refund, or customer-contact side effect.

## MCP Streamable HTTP tool surface

### `POST /api/mcp`

This endpoint uses the official `@modelcontextprotocol/server` v2 SDK and its per-request `createMcpHandler` transport. It serves the current `2026-07-28` MCP protocol with `server/discover`, `tools/list`, and `tools/call` for:

- `lookup_return_by_label`;
- `analyze_return_contents`;
- `draft_return_communication`;
- `record_return_review`;
- `queue_test_communication`.

The `/intake` browser workflow invokes these tool calls through `/api/mcp`; native REST routes expose the same service contracts. Tool registrations advertise the same Zod input and output schemas used at the service/domain boundary, plus the same DynamoDB access, deterministic money guards, server-enforced review requirements, model-evaluation budgets, and delivery-disabled outbox as the REST routes. A tool-domain or service failure is returned as a valid `CallToolResult` with `isError:true`, safe text content, and a structured error object; it is not misreported as a successful tool result.

Current-protocol requests carry the required per-request `_meta` envelope and standard headers. A `tools/call` request has this shape (values abbreviated):

```http
POST /api/mcp
Content-Type: application/json
Accept: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: lookup_return_by_label
X-Demo-Session: <anonymous-demo-session>
```

```json
{
  "jsonrpc": "2.0",
  "id": "call-1",
  "method": "tools/call",
  "params": {
    "name": "lookup_return_by_label",
    "arguments": { "fixtureId": "labelRma8821" },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": { "name": "example-client", "version": "1.0.0" },
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

Transport scope is intentionally bounded for Lambda/API Gateway:

- every request receives a fresh SDK `McpServer` and transport; no `Mcp-Session-Id` is issued or accepted as application state;
- current-protocol tool calls return one buffered terminal JSON response; mid-call logging/progress notifications are dropped;
- subscriptions are disabled, so no long-lived `subscriptions/listen` stream, server notification bus, or resumability contract is exposed;
- stateless `GET` and `DELETE` session operations return `405`;
- the SDK's stateless compatibility leg still accepts 2025-era `initialize`/tool requests and returns their finite response as `text/event-stream`;
- the existing `X-Demo-Session` or secure demo cookie is an application capability gate, not MCP OAuth, tenant authentication, or verified operator identity.

These limitations do not change tool-call wire conformance, but they do mean this is not a sessionful or production-authenticated MCP deployment. External production exposure still requires OAuth/resource-server design, Redo tenant RBAC, official-client interoperability tests, and a dedicated MCP conformance/security review. See the official SDK's [Streamable HTTP serving guide](https://ts.sdk.modelcontextprotocol.io/v2/serving/http) and [protocol-version guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md).

### `GET /api/metrics`

Returns illustrative/synthetic measurement output for the public lab. Response includes cohort definitions, metric definitions, warnings, and experiment method. The `$80M` and `$200M` scenario cohorts are never added.

### `POST /api/waitlist`

No session required. It is the only endpoint that persists non-synthetic contact data.

```json
{
  "email": "researcher@example.com",
  "role": "merchant-operations",
  "companyUrl": "https://example.com",
  "consent": true,
  "noticeVersion": "2026-08-24"
}
```

Validation:

- normalized valid email, bounded length;
- allowlisted/bounded role;
- optional HTTPS company URL;
- `consent` must be `true`;
- notice version must be supported;
- hash-based idempotent dedupe;
- no email is sent;
- no public GET route.

Response `201` or duplicate `200`:

```json
{
  "state": "CREATED",
  "message": "Thanks—your consented waitlist request was recorded. This demo does not send email. Active-retention target: 30 days; AWS TTL deletion and retained backups may lag per policy.",
  "retentionDays": 30,
  "controller": "Canyon"
}
```

## Internal evidence packet contract

A payment-dispute adapter consumes a manifest, not arbitrary prose:

```json
{
  "packetId": "…",
  "caseId": "…",
  "state": "EVIDENCE_READY",
  "disputeId": null,
  "reasonCode": null,
  "artifacts": [
    {
      "evidenceId": "ev-opening-view",
      "checksum": "sha256:…",
      "sourceSystem": "MANAGED_WAREHOUSE",
      "observedAt": "…",
      "statement": "Protocol opening view shows no authorized item visible."
    }
  ],
  "approvedNarrative": "…",
  "createdAt": "…"
}
```

`EVIDENCE_READY` is not `SUBMITTED`. An authorized processor inquiry/alert/dispute plus authenticated adapter response is required before the state changes.

## Idempotency and versioning

- Mutating action idempotency is a documented production requirement but is not implemented by the prototype API.
- Case projection writes use an expected version in production.
- Events have stable provider IDs to dedupe webhook replays.
- API/domain/prompt/schema/policy/protocol versions are stored independently.

## Logging contract

Log only route, status, request ID, one-way session hash, case/checkpoint ID, latency, model/version, budget result, and error class. Never log waitlist email, addresses, signed URLs, evidence body/image, raw prompt/response, secret, token, or identity detail.
