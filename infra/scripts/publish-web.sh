#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="${STACK_NAME:-RedoReturnIntegrity-demo}"
AWS_REGION="${AWS_REGION:-us-west-2}"
WEB_DIST="${WEB_DIST:-../apps/web/dist}"

if [[ ! -f "${WEB_DIST}/index.html" ]]; then
  echo "Missing ${WEB_DIST}/index.html. Run npm run build from the repository root first." >&2
  exit 1
fi

web_bucket_name="$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${AWS_REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='WebBucketName'].OutputValue" \
  --output text)"

distribution_id="$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${AWS_REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text)"

if [[ -z "${web_bucket_name}" || "${web_bucket_name}" == "None" ]]; then
  echo "Could not resolve WebBucketName from ${STACK_NAME}." >&2
  exit 1
fi

if [[ -z "${distribution_id}" || "${distribution_id}" == "None" ]]; then
  echo "Could not resolve DistributionId from ${STACK_NAME}." >&2
  exit 1
fi

aws s3 sync "${WEB_DIST}" "s3://${web_bucket_name}" \
  --delete \
  --exclude "index.html" \
  --cache-control "public,max-age=31536000,immutable" \
  --region "${AWS_REGION}"

aws s3 cp "${WEB_DIST}/index.html" "s3://${web_bucket_name}/index.html" \
  --cache-control "no-cache,no-store,must-revalidate" \
  --content-type "text/html; charset=utf-8" \
  --region "${AWS_REGION}"

aws cloudfront create-invalidation \
  --distribution-id "${distribution_id}" \
  --paths "/index.html" "/" >/dev/null

echo "Published ${WEB_DIST} to ${web_bucket_name} and invalidated ${distribution_id}."
