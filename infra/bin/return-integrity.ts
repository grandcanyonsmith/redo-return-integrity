#!/usr/bin/env node
import 'source-map-support/register.js';
import { App } from 'aws-cdk-lib';
import { ReturnIntegrityStack } from '../src/return-integrity-stack.js';

const app = new App();
const stage = app.node.tryGetContext('stage') ?? 'demo';

new ReturnIntegrityStack(app, `RedoReturnIntegrity-${stage}`, {
  description: 'Evidence-led return integrity demo: web, API, ephemeral evidence, and consented waitlist.',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-west-2',
  },
  stage,
});
