#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

const region = process.env.AWS_REGION ?? 'us-west-2';
const stage = process.env.APP_STAGE ?? 'demo';
const stackName = process.env.STACK_NAME ?? `RedoReturnIntegrity-${stage}`;

const cloudFormation = new CloudFormationClient({ region });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
  marshallOptions: { removeUndefinedValues: true },
});

const outputValue = (stack, key) => stack.Outputs?.find((output) => output.OutputKey === key)?.OutputValue;

const stackResult = await cloudFormation.send(new DescribeStacksCommand({ StackName: stackName }));
const stack = stackResult.Stacks?.[0];

if (!stack) {
  throw new Error(`CloudFormation stack ${stackName} was not found in ${region}.`);
}

const tags = Object.fromEntries((stack.Tags ?? []).map(({ Key, Value }) => [Key, Value]));
if (
  tags.Application !== 'RedoReturnIntegrity'
  || tags.Stage !== stage
  || tags.DataClassification !== 'SyntheticDemo'
) {
  throw new Error(`Stack ${stackName} is not tagged as the expected ${stage} synthetic demo stack.`);
}

if (process.env.CONFIRM_SYNTHETIC_SEED !== stackName) {
  throw new Error(`Set CONFIRM_SYNTHETIC_SEED=${stackName} to authorize the bounded synthetic seed.`);
}

const stackTableName = outputValue(stack, 'ReturnLookupTableName');
const stackPublicBaseUrl = outputValue(stack, 'ApplicationUrl')?.replace(/\/$/, '');
if (process.env.RETURN_LOOKUP_TABLE_NAME && process.env.RETURN_LOOKUP_TABLE_NAME !== stackTableName) {
  throw new Error('RETURN_LOOKUP_TABLE_NAME does not match the selected stack output.');
}
if (process.env.PUBLIC_BASE_URL?.replace(/\/$/, '') && process.env.PUBLIC_BASE_URL.replace(/\/$/, '') !== stackPublicBaseUrl) {
  throw new Error('PUBLIC_BASE_URL does not match the selected stack output.');
}
const tableName = stackTableName;
const publicBaseUrl = stackPublicBaseUrl;

if (!tableName || !publicBaseUrl) {
  throw new Error('The stack must expose ReturnLookupTableName and ApplicationUrl outputs.');
}

const catalogImageUrl = `${publicBaseUrl}/evidence/catalog-juniper-arc-one.png`;
const refundPolicySnapshot = {
  policyId: 'juniper-return-policy',
  policyVersion: '2026-08-24.v1',
  currency: 'USD',
  maxEligibleRefundCents: 184900,
  allowPartialRefund: true,
  quantityProration: true,
  damagedItemRefundPercent: 50,
  adverseActionRequiresHumanApproval: true,
  customerContestWindowHours: 72,
};
const refundPolicySnapshotSha256 = createHash('sha256')
  .update(JSON.stringify(refundPolicySnapshot), 'utf8')
  .digest('hex');

const profiles = [
  {
    returnRecordId: 'ret-jc-1042',
    orderId: 'JC-1042',
    rma: 'RMA-8821',
    trackingNumber: '1Z-REDO-8821',
    labelId: 'LBL-8821',
    scenario: 'QUANTITY_MISMATCH',
    customer: {
      customerId: 'demo-shopper-001',
      name: 'Avery Demo',
      email: 'avery.return@example.test',
      phone: '+1-555-010-8821',
      lifetimeOrders: 4,
      lifetimeReturns: 1,
      priorConfirmedFraud: 0,
    },
  },
  {
    returnRecordId: 'ret-jc-1048',
    orderId: 'JC-1048',
    rma: 'RMA-EMPTY-1048',
    trackingNumber: '1Z-REDO-1048',
    labelId: 'LBL-EMPTY-1048',
    scenario: 'EMPTY_BOX',
    customer: {
      customerId: 'demo-shopper-002',
      name: 'Morgan Example',
      email: 'morgan.return@example.test',
      phone: '+1-555-010-1048',
      lifetimeOrders: 2,
      lifetimeReturns: 1,
      priorConfirmedFraud: 0,
    },
  },
  {
    returnRecordId: 'ret-jc-1051',
    orderId: 'JC-1051',
    rma: 'RMA-DAMAGE-1051',
    trackingNumber: '1Z-REDO-1051',
    labelId: 'LBL-DAMAGE-1051',
    scenario: 'DAMAGED_PRODUCT',
    customer: {
      customerId: 'demo-shopper-003',
      name: 'Riley Sample',
      email: 'riley.return@example.test',
      phone: '+1-555-010-1051',
      lifetimeOrders: 7,
      lifetimeReturns: 2,
      priorConfirmedFraud: 0,
    },
  },
  {
    returnRecordId: 'ret-jc-1056',
    orderId: 'JC-1056',
    rma: 'RMA-WRONG-1056',
    trackingNumber: '1Z-REDO-1056',
    labelId: 'LBL-WRONG-1056',
    scenario: 'WRONG_PRODUCT',
    customer: {
      customerId: 'demo-shopper-004',
      name: 'Taylor Fixture',
      email: 'taylor.return@example.test',
      phone: '+1-555-010-1056',
      lifetimeOrders: 3,
      lifetimeReturns: 2,
      priorConfirmedFraud: 0,
    },
  },
  {
    returnRecordId: 'ret-jc-1060',
    orderId: 'JC-1060',
    rma: 'RMA-IMITATION-1060',
    trackingNumber: '1Z-REDO-1060',
    labelId: 'LBL-IMITATION-1060',
    scenario: 'POSSIBLE_IMITATION',
    customer: {
      customerId: 'demo-shopper-005',
      name: 'Jordan Synthetic',
      email: 'jordan.return@example.test',
      phone: '+1-555-010-1060',
      lifetimeOrders: 5,
      lifetimeReturns: 2,
      priorConfirmedFraud: 0,
    },
  },
].map((profile) => ({
  PK: `RETURN#${profile.returnRecordId}`,
  SK: 'PROFILE',
  entityType: 'RETURN_PROFILE',
  schemaVersion: 1,
  synthetic: true,
  merchant: {
    merchantId: 'juniper-circuit-demo',
    name: 'Juniper Circuit',
  },
  status: 'DELIVERED_PENDING_INSPECTION',
  requestedResolution: 'REFUND',
  returnRequest: {
    requestedRefundCents: 184900,
    currency: 'USD',
    requestedAt: '2026-08-24T14:00:00.000Z',
  },
  returnReason: 'Changed mind',
  receivedAt: '2026-08-24T14:30:00.000Z',
  order: {
    orderId: profile.orderId,
    currency: 'USD',
    orderTotalCents: 184900,
    paymentProcessor: 'TEST_SHOPIFY_PAYMENTS',
    paymentLast4: '4242',
  },
  identifiers: {
    rma: profile.rma,
    trackingNumber: profile.trackingNumber,
    labelId: profile.labelId,
  },
  customer: profile.customer,
  expectedItems: [
    {
      sku: 'JC-ARC-ONE-KIT',
      title: 'Juniper Arc One two-camera kit',
      variant: 'Matte black / two pack',
      quantity: 2,
      unitRefundableCents: 92450,
      totalRefundableCents: 184900,
      expectedSerials: ['JCA1-88K2', 'JCA1-91M7'],
      catalogImageUrl,
    },
  ],
  shipping: {
    expectedPackedWeightGrams: 1800,
    carrierRecordedWeightGrams: 1120,
  },
  refundPolicy: {
    ...refundPolicySnapshot,
    snapshotSha256: refundPolicySnapshotSha256,
  },
  seededScenario: profile.scenario,
  createdAt: '2026-08-24T14:30:00.000Z',
  updatedAt: '2026-08-24T14:30:00.000Z',
}));

const normalize = (value) => value.trim().toUpperCase();
const items = profiles.flatMap((profile) => {
  const recordId = profile.PK.slice('RETURN#'.length);
  const aliases = [
    ['LABEL', profile.identifiers.labelId],
    ['RMA', profile.identifiers.rma],
    ['ORDER', profile.order.orderId],
    ['TRACKING', profile.identifiers.trackingNumber],
  ];

  return [
    profile,
    ...aliases.map(([type, identifier]) => ({
      PK: `LOOKUP#${type}#${normalize(identifier)}`,
      SK: 'POINTER',
      entityType: 'RETURN_LOOKUP_ALIAS',
      returnRecordId: recordId,
      synthetic: true,
      updatedAt: profile.updatedAt,
    })),
  ];
});

if (items.length !== 25 || items.some((item) => item.synthetic !== true)) {
  throw new Error(`Expected exactly 25 explicitly synthetic items; received ${items.length}.`);
}

// This is atomic and refuses to overwrite any record that was not explicitly
// created as synthetic data by a prior seed. A collision leaves the table
// untouched instead of partially mixing demo and non-demo records.
await dynamo.send(new TransactWriteCommand({
  TransactItems: items.map((Item) => ({
    Put: {
      TableName: tableName,
      Item,
      ConditionExpression: 'attribute_not_exists(PK) OR #synthetic = :synthetic',
      ExpressionAttributeNames: { '#synthetic': 'synthetic' },
      ExpressionAttributeValues: { ':synthetic': true },
    },
  })),
}));

console.log(JSON.stringify({
  stackName,
  region,
  tableName,
  profileCount: profiles.length,
  itemCount: items.length,
  synthetic: true,
}, null, 2));
