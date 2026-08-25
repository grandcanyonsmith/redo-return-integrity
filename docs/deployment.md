# AWS deployment guide

Target: AWS `us-west-2`. Infrastructure is authored in TypeScript CDK and synthesizes standard CloudFormation. Deployment is intentionally manual; GitHub Actions verifies but has no cloud credentials or deploy job.

## What the stack creates

- private, versioned S3 web/fixture bucket;
- CloudFront distribution with S3 Origin Access Control and SPA fallback;
- uncached `/api/*` behavior to API Gateway HTTP API;
- Node.js 22 ARM Lambda bundled from `services/api/src/handler.ts`;
- DynamoDB session/case/event table with TTL and point-in-time recovery;
- dedicated DynamoDB return-lookup table with point-in-time recovery for globally keyed synthetic label/RMA/order/tracking aliases plus session-scoped completed evidence, inspections, drafts, reviews, and the test outbox;
- separate email-hash-keyed waitlist table with 30-day TTL and point-in-time recovery;
- private, versioned upload bucket with one-day current/noncurrent-version lifecycle and CORS exposure of `x-amz-version-id`; the older case-scoped presign remains nonfinalized, while intake presign uses a 60-second exact-length/checksum S3 POST policy and `/api/uploads/complete` validates session/purpose binding, immutable version, metadata, size, MIME signature, S3 checksum, and recomputed SHA-256; fresh read/model URLs last 300 seconds and are never persisted;
- IAM permission to read an existing Secrets Manager secret named `OPENAI_API_KEY`;
- retained seven-day API log group and CloudWatch error/throttle/latency alarms.

Data buckets/tables/log group use `RETAIN` so deleting the stack does not erase evidence or opted-in records.

## Prerequisites

- Node.js 22 and npm 10+
- AWS CLI v2 authenticated to the intended account
- permission to deploy CDK/CloudFormation, IAM, Lambda, API Gateway, CloudFront, S3, DynamoDB, Secrets Manager references, CloudWatch, and CDK bootstrap resources
- OpenAI project API key with access to the configured model

Verify identity and region before any write:

```bash
aws sts get-caller-identity
aws configure get region
```

The CDK app rejects any target region other than `us-west-2`.

## Install and verify locally

From the repository root:

```bash
npm ci
npm run verify
```

`verify` runs workspace typechecks, unit tests, builds, and CDK synthesis. End-to-end browser tests are separate:

```bash
npm run test:e2e
```

## Configure the OpenAI secret

The stack references an existing secret named exactly `OPENAI_API_KEY`; it never accepts the key as a CloudFormation parameter.

Check for the secret name without reading its value:

```bash
aws secretsmanager describe-secret \
  --secret-id OPENAI_API_KEY \
  --region us-west-2 \
  --query '{Name:Name,ARN:ARN,LastChangedDate:LastChangedDate}'
```

If absent, create it through the AWS Secrets Manager console or an interactive shell that does not place the value in history:

```bash
read -r -s RETURN_INTEGRITY_OPENAI_KEY
aws secretsmanager create-secret \
  --name OPENAI_API_KEY \
  --description "OpenAI key for Redo Return Integrity demo" \
  --secret-string "${RETURN_INTEGRITY_OPENAI_KEY}" \
  --region us-west-2
unset RETURN_INTEGRITY_OPENAI_KEY
```

If the name already exists, use `put-secret-value` under the same precautions. Do not store the key in `.env`, GitHub, CDK context, CloudFormation output, shell history, source, screenshots, or Loom.

Without the secret/value, the app still demonstrates deterministic rules and safe fallback; the UI must label the OpenAI assessment unavailable and route to human review. It cannot be described as a successful live-model evaluation.

## Bootstrap CDK once per account/region

Use the exact account ID returned by the identity check:

```bash
npx cdk bootstrap aws://ACCOUNT_ID/us-west-2 \
  --app "npx tsx infra/bin/return-integrity.ts"
```

Review the bootstrap change because it creates shared deployment resources and roles.

## Inspect the change set

```bash
npm run synth
npm run diff --workspace @return-integrity/infra
```

Review at minimum:

- stack is `RedoReturnIntegrity-demo` in `us-west-2`;
- S3 buckets block public access;
- CloudFront uses OAC, not a public website endpoint;
- API Lambda secret permission is read-only to `OPENAI_API_KEY`;
- Lambda has only table/upload access needed by the application;
- upload IAM includes exact-version reads, upload-bucket versioning is enabled, CORS allows form POST and exposes `x-amz-version-id`, and the Lambda bundle contains the presigned-POST helper;
- Lambda environment includes the intended 12/session and 120/day upload-policy limits as well as 30/session and 250/day model-evaluation limits;
- return-profile seed data is visibly synthetic and global; no real merchant/customer record is present and no documentation treats the demo session as tenant authorization;
- no secret value or personal fixture appears in `cdk.out`;
- data resources are retained on deletion;
- API default route rate is 10 requests/second with burst 20.

## Deploy infrastructure/API

```bash
npm run deploy --workspace @return-integrity/infra
```

CDK uses `--require-approval broadening`. Do not bypass the IAM review in an unfamiliar account.

Expected outputs:

- `ApplicationUrl`
- `DistributionId`
- `WebBucketName`
- `UploadBucketName`
- `ApiEndpoint`
- `CaseTableName`
- `WaitlistTableName`
- `ReturnLookupTableName`
- `OpenAiSecretName`

Capture outputs without secret values:

```bash
aws cloudformation describe-stacks \
  --stack-name RedoReturnIntegrity-demo \
  --region us-west-2 \
  --query 'Stacks[0].Outputs[].{Key:OutputKey,Value:OutputValue}' \
  --output table
```

## Seed synthetic return records

After the first deployment that creates `ReturnLookupTableName`, seed the five privacy-safe demo returns and their label/RMA/order/tracking aliases:

```bash
CONFIRM_SYNTHETIC_SEED=RedoReturnIntegrity-demo npm run seed:demo --workspace @return-integrity/infra
```

The script resolves only `ReturnLookupTableName` and `ApplicationUrl` from the exact `RedoReturnIntegrity-demo` stack in `us-west-2`, checks the stack's application/stage/data-classification tags, requires the exact confirmation string, and atomically writes 5 profiles plus 20 aliases using only fictional `example.test` contacts. Every profile contains an explicit requested amount/currency and a canonical refund-policy ID/version/snapshot hash. Stable keys make a synthetic-only replay idempotent; the transaction refuses a collision with a non-synthetic record and never scans or deletes the table.

## Publish the React build

Build from the repository root, then run the scoped publisher from `infra`:

```bash
npm run build
cd infra
npm run publish:web
```

The script resolves the exact stack outputs, synchronizes only `../apps/web/dist` to that stack's web bucket, gives hashed assets immutable cache headers, gives `index.html` no-cache headers, and invalidates `/` plus `/index.html`. It uses `s3 sync --delete`; review `STACK_NAME`, `AWS_REGION`, and `WEB_DIST` before running because objects absent from that build directory will be removed from that one resolved bucket.

Overrides:

```bash
STACK_NAME=RedoReturnIntegrity-demo \
AWS_REGION=us-west-2 \
WEB_DIST=../apps/web/dist \
npm run publish:web
```

## Smoke tests

Set the CloudFormation `ApplicationUrl` explicitly, then test:

```bash
RETURN_INTEGRITY_URL="https://DISTRIBUTION_DOMAIN"
curl --fail --silent --show-error "${RETURN_INTEGRITY_URL}/api/health"
curl --fail --silent --show-error --head "${RETURN_INTEGRITY_URL}/"
```

In a browser:

1. open a fresh private window and create/reset a session;
2. complete the good-actor checkout cure;
3. run reverse-logistics receipt cure;
4. run physical inspection and confirm the model/policy/human separation;
5. verify no final denial occurs without explicit human action;
6. appeal and confirm the prior decision remains in the timeline;
7. verify `EVIDENCE_READY` is not shown as submitted;
8. submit a consented test waitlist address and confirm no email is sent;
9. open **Return intake**, load the RMA-8821 label fixture, confirm the AWS lookup returns explicit requested refund/currency plus policy ID/version/snapshot hash, and analyze each package fixture; inspect the structured `modelAudit` on an inspection;
10. with a privacy-safe synthetic image, verify presign returns `formFields` and an opaque purpose-scoped key without the raw session ID; POST the multipart form and confirm S3 exposes a non-`null` `x-amz-version-id`;
11. complete the upload with that version ID, confirm purpose/checksum/size validation succeeds, confirm `RETURN_LABEL` evidence is rejected by package analysis and `PACKAGE_CONTENTS` evidence is rejected by label lookup, and confirm subsequent inspection/draft views use fresh 300-second read URLs for that same immutable version rather than a persisted URL;
12. preview a test email, inspect its `modelAudit` and `contentSha256`, persist the evidence-complete demo operator review with `draftDecision:"APPROVE_AS_WRITTEN"`, queue it to the test outbox, and confirm the review/outbox carry the same draft hash while the UI never reports delivery;
13. call `/api/mcp` with a `2026-07-28` per-request `_meta` envelope plus the required `MCP-Protocol-Version` and `Mcp-Method` headers; run `server/discover`, then `tools/list`, and verify the five documented SDK-registered tool contracts are returned without the removed inline-image field;
14. repeat in a second private window and verify session/evidence isolation; separately acknowledge that seeded alias/profile lookup is globally available synthetic fixture data and therefore does not demonstrate tenant isolation;
15. inspect at 390px, 768px, and desktop widths.

Check CloudWatch after the run; do not paste evidence or secret-bearing logs into the deliverables.

## Rollback

### Web-only rollback

Because the web bucket is versioned, restore the prior `index.html` and asset set deliberately, then invalidate CloudFront. Prefer rebuilding the known Git commit and republishing over ad hoc object edits.

### API/infrastructure rollback

- deploy the previous known Git commit through CDK;
- disable model calls with configuration/code fallback if the model path is implicated;
- route affected cases to human review;
- do not delete tables/buckets to roll back application code.

### Secret incident

Rotate/revoke the OpenAI key, store a new version in Secrets Manager, and review Lambda/log access. The Lambda fetch path should pick up the new secret value without a CloudFormation secret change.

## Teardown

```bash
npx cdk destroy --app "npx tsx infra/bin/return-integrity.ts"
```

This removes the serving/API resources but intentionally retains tables, buckets, and API logs. Removing retained records is a separate destructive operation that requires exact-target review, data-owner approval, and confirmation of waitlist/evidence obligations.

## Known production gaps

- anonymous capability instead of Redo authentication/RBAC; seeded return profiles and aliases are globally keyed synthetic fixtures, so production requires tenant-prefixed lookup keys and tenant binding across lookup/evidence/inspection/draft/review/outbox records;
- no custom domain or certificate;
- no WAF/origin-verification header;
- 60-second presigned upload forms are replayable by their bearer within their fixed key/exact-byte/MIME/checksum/purpose constraints; the demo limits issuance to 12/session and 120/day, but there is no single-use issuance record, authenticated tenant byte budget, or dedicated storage-cost alarm yet;
- synchronous model path rather than queue/worker/DLQ;
- no live Shopify/Stripe/carrier/ID/WMS/Reclaim adapters;
- the official MCP v2 Streamable HTTP endpoint is deliberately stateless and API-Gateway-buffered: no MCP sessions, resumability, subscriptions, server-to-client streams, or mid-call progress/log notifications; its anonymous demo-session capability is not production MCP OAuth or Redo tenant RBAC;
- test outbox only; no production email/SMS sender or delivery claim;
- no security notification target or production SLO;
- synthetic fixtures and public-demo retention, not merchant data controls.
