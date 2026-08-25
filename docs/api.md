# HTTP API contract

Version: prototype `v0.1`. Public base path: `/api`. The CloudFront behavior is uncached. JSON is UTF-8. The current UI can fall back to local synthetic decisions when the API is unavailable; fallback is visibly labeled and never described as a live OpenAI result.

## Session capability

Production merchant auth is out of scope. The demo uses a random, 24-hour session capability. Preferred transport after creation:

```http
x-demo-session: 575f…
```

The browser also receives an `HttpOnly; Secure; SameSite=Strict` cookie. It currently sends the session header for explicitness. Session IDs must not appear in logs or analytics except as a one-way hash.

## Common response and errors

Success responses are JSON. Errors use:

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
| `403` | session does not own case/evidence or role cannot perform action |
| `404` | object not found in authorized scope |
| `409` | idempotency/state/version conflict |
| `400` | prototype upload declaration exceeds 5 MB or is not JPEG/PNG/WebP; production should specialize this to `413`/`415` |
| `422` | valid JSON but unsupported action/evidence state |
| `429` | per-session, daily-model, or API throttle |
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
  "policy": "human-final-adverse-decisions"
}
```

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

Creates a short-lived presigned PUT contract after validating requested media type and declared size. Allowed: `image/jpeg`, `image/png`, `image/webp`; maximum 5,000,000 bytes. Real government ID, face capture, and real labels are prohibited by the demo notice.

```json
{
  "checkpointId": "REVERSE_HANDOFF",
  "mimeType": "image/webp",
  "sizeBytes": 481234,
  "sha256": "64-lowercase-or-uppercase-hex-characters"
}
```

Response contains a five-minute `uploadUrl`, `objectKey`, and explicit `UPLOAD_URL_ISSUED_NOT_EVIDENCE` state. Completing upload does not make an artifact or decision-ready evidence. The prototype has no finalize route; curated fixture attachment is the only supported image-evidence flow. A production finalize/validation step must confirm magic bytes/checksum before creating an `EvidenceArtifact`.

### `GET /api/cases/{caseId}/evidence/{evidenceId}`

Returns metadata plus a very short-lived authorized read URL only when the session owns the case and artifact is unexpired. Response uses `Cache-Control: no-store`.

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
