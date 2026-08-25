import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const stackSource = await readFile(new URL('../src/return-integrity-stack.ts', import.meta.url), 'utf8');

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
  assert.match(stackSource, /timeToLiveAttribute: 'ttl'/);
  assert.match(stackSource, /x-amz-meta-\*/);
  assert.doesNotMatch(stackSource, /minimumProtocolVersion/);
});

test('OpenAI secret value is never embedded in the stack', () => {
  assert.match(stackSource, /OPENAI_API_KEY/);
  assert.doesNotMatch(stackSource, /sk-[A-Za-z0-9]/);
});
