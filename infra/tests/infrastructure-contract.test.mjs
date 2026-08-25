import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const stackSource = await readFile(new URL('../src/return-integrity-stack.ts', import.meta.url), 'utf8');
const seedSource = await readFile(new URL('../scripts/seed-demo-return-data.mjs', import.meta.url), 'utf8');

test('infrastructure keeps high-risk evidence controls explicit', () => {
  assert.match(stackSource, /BLOCK_ALL/);
  assert.match(stackSource, /withOriginAccessControl/);
  assert.match(stackSource, /ExpireEphemeralEvidence/);
  assert.match(stackSource, /WAITLIST_TTL_DAYS: '30'/);
  assert.match(stackSource, /MAX_EVALUATIONS_PER_SESSION: '30'/);
  assert.match(stackSource, /DAILY_EVALUATION_LIMIT: '250'/);
  assert.match(stackSource, /partitionKey: \{ name: 'PK'/);
  assert.match(stackSource, /sortKey: \{ name: 'SK'/);
  assert.match(stackSource, /partitionKey: \{ name: 'emailHash'/);
  assert.match(stackSource, /ReturnLookupTable/);
  assert.match(stackSource, /RETURN_LOOKUP_TABLE_NAME/);
  assert.match(stackSource, /ReturnLookupTableName/);
  assert.match(stackSource, /timeToLiveAttribute: 'ttl'/);
  assert.match(stackSource, /x-amz-meta-\*/);
  assert.match(stackSource, /versioned: true/);
  assert.match(stackSource, /x-amz-version-id/);
  assert.match(stackSource, /s3\.HttpMethods\.POST/);
  assert.match(stackSource, /s3:GetObjectVersion/);
  assert.match(stackSource, /bundleAwsSDK: true/);
  assert.match(stackSource, /SpaRewriteFunction/);
  assert.match(stackSource, /FunctionEventType\.VIEWER_REQUEST/);
  assert.doesNotMatch(stackSource, /errorResponses:/);
  assert.doesNotMatch(stackSource, /minimumProtocolVersion/);
});

test('OpenAI secret value is never embedded in the stack', () => {
  assert.match(stackSource, /OPENAI_API_KEY/);
  assert.doesNotMatch(stackSource, /sk-[A-Za-z0-9]/);
});

test('demo lookup seed is synthetic, bounded, and includes deterministic aliases', () => {
  assert.match(seedSource, /profileCount: profiles\.length/);
  assert.match(seedSource, /items\.length !== 25/);
  assert.match(seedSource, /example\.test/);
  assert.match(seedSource, /LOOKUP#\$\{type\}#/);
  assert.match(seedSource, /adverseActionRequiresHumanApproval: true/);
  assert.doesNotMatch(seedSource, /@(gmail|yahoo|outlook)\.com/);
});
