# AWS deployment guide

Target: AWS `us-west-2`. Infrastructure is authored in TypeScript CDK and synthesizes standard CloudFormation. Deployment is intentionally manual; GitHub Actions verifies but has no cloud credentials or deploy job.

## What the stack creates

- private, versioned S3 web/fixture bucket;
- CloudFront distribution with S3 Origin Access Control and SPA fallback;
- uncached `/api/*` behavior to API Gateway HTTP API;
- Node.js 22 ARM Lambda bundled from `services/api/src/handler.ts`;
- DynamoDB session/case/event table with TTL and point-in-time recovery;
- separate email-hash-keyed waitlist table with 30-day TTL and point-in-time recovery;
- private upload-scaffold bucket with one-day lifecycle; issued objects remain non-evidence until a future finalize/magic-byte check;
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
- `OpenAiSecretName`

Capture outputs without secret values:

```bash
aws cloudformation describe-stacks \
  --stack-name RedoReturnIntegrity-demo \
  --region us-west-2 \
  --query 'Stacks[0].Outputs[].{Key:OutputKey,Value:OutputValue}' \
  --output table
```

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
9. repeat in a second private window and verify session isolation;
10. inspect at 390px, 768px, and desktop widths.

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

- anonymous capability instead of Redo authentication/RBAC;
- no custom domain or certificate;
- no WAF/origin-verification header;
- synchronous model path rather than queue/worker/DLQ;
- no live Shopify/Stripe/carrier/ID/WMS/Reclaim adapters;
- no upload-finalize/magic-byte path; curated fixtures are the only demonstrated image evidence;
- no security notification target or production SLO;
- synthetic fixtures and public-demo retention, not merchant data controls.
