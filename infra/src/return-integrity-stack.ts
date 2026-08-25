import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
  Tags,
} from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export interface ReturnIntegrityStackProps extends StackProps {
  readonly stage: string;
}

/**
 * Single-region interview/demo stack. The architecture intentionally keeps
 * demo-session evidence separate from opted-in waitlist records.
 */
export class ReturnIntegrityStack extends Stack {
  constructor(scope: Construct, id: string, props: ReturnIntegrityStackProps) {
    super(scope, id, props);

    if (this.region !== 'us-west-2') {
      throw new Error(`Redo Return Integrity is intentionally pinned to us-west-2; received ${this.region}.`);
    }

    const dataRemovalPolicy = RemovalPolicy.RETAIN;

    const webBucket = new s3.Bucket(this, 'WebAndFixtureBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: dataRemovalPolicy,
      versioned: true,
    });

    const uploadBucket = new s3.Bucket(this, 'EphemeralUploadBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: dataRemovalPolicy,
      cors: [
        {
          allowedHeaders: ['content-type', 'x-amz-checksum-sha256', 'x-amz-meta-*'],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          exposedHeaders: ['etag', 'x-amz-checksum-sha256'],
          maxAge: 300,
        },
      ],
      lifecycleRules: [
        {
          id: 'ExpireEphemeralEvidence',
          enabled: true,
          expiration: Duration.days(1),
          abortIncompleteMultipartUploadAfter: Duration.days(1),
          noncurrentVersionExpiration: Duration.days(1),
        },
      ],
    });

    const caseTable = new dynamodb.Table(this, 'CaseSessionEventTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: 'ttl',
      removalPolicy: dataRemovalPolicy,
    });

    const waitlistTable = new dynamodb.Table(this, 'WaitlistTable', {
      partitionKey: { name: 'emailHash', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: 'ttl',
      removalPolicy: dataRemovalPolicy,
    });

    // The secret is created out-of-band so the value never appears in source,
    // cdk.out, CloudFormation parameters, or Lambda environment variables.
    const openAiSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'OpenAiApiKeySecret',
      'OPENAI_API_KEY',
    );

    const apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const apiFunction = new lambdaNode.NodejsFunction(this, 'ApiFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(currentDirectory, '../../services/api/src/handler.ts'),
      handler: 'handler',
      memorySize: 1024,
      timeout: Duration.seconds(30),
      logGroup: apiLogGroup,
      tracing: lambda.Tracing.ACTIVE,
      bundling: {
        minify: true,
        sourceMap: true,
        sourcesContent: false,
        target: 'node22',
      },
      environment: {
        APP_STAGE: props.stage,
        CASE_TABLE_NAME: caseTable.tableName,
        CASES_TABLE_NAME: caseTable.tableName,
        WAITLIST_TABLE_NAME: waitlistTable.tableName,
        UPLOAD_BUCKET_NAME: uploadBucket.bucketName,
        OPENAI_SECRET_NAME: 'OPENAI_API_KEY',
        OPENAI_PRIMARY_MODEL: 'gpt-5.6-terra',
        OPENAI_MODEL: 'gpt-5.6-terra',
        OPENAI_ESCALATION_MODEL: 'gpt-5.6-sol',
        SESSION_TTL_HOURS: '24',
        WAITLIST_TTL_DAYS: '30',
        UPLOAD_TTL_HOURS: '24',
        MAX_EVALUATIONS_PER_SESSION: '30',
        DAILY_EVALUATION_LIMIT: '250',
        DEMO_MODE: 'true',
      },
    });

    caseTable.grant(
      apiFunction,
      'dynamodb:GetItem',
      'dynamodb:PutItem',
      'dynamodb:UpdateItem',
      'dynamodb:DeleteItem',
      'dynamodb:Query',
      'dynamodb:TransactWriteItems',
    );
    waitlistTable.grant(apiFunction, 'dynamodb:PutItem');
    apiFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:PutObject'],
      resources: [uploadBucket.arnForObjects('ephemeral/*')],
    }));
    openAiSecret.grantRead(apiFunction);

    const api = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: `redo-return-integrity-${props.stage}`,
      corsPreflight: {
        allowHeaders: ['authorization', 'content-type', 'x-demo-session'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
        maxAge: Duration.hours(1),
      },
      defaultIntegration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'DefaultLambdaIntegration',
        apiFunction,
        { payloadFormatVersion: apigatewayv2.PayloadFormatVersion.VERSION_2_0 },
      ),
    });

    const defaultStageResource = api.defaultStage?.node.defaultChild as
      | apigatewayv2.CfnStage
      | undefined;
    defaultStageResource?.addPropertyOverride('DefaultRouteSettings', {
      DetailedMetricsEnabled: true,
      ThrottlingBurstLimit: 20,
      ThrottlingRateLimit: 10,
    });

    const apiDomain = `${api.apiId}.execute-api.${this.region}.${this.urlSuffix}`;
    const browserSecurityHeaders = new cloudfront.ResponseHeadersPolicy(this, 'BrowserSecurityHeaders', {
      comment: 'CSP and browser hardening for the public synthetic Return Integrity demo.',
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          contentSecurityPolicy: [
            "default-src 'self'",
            "base-uri 'self'",
            "object-src 'none'",
            "frame-ancestors 'none'",
            "form-action 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' data: https://fonts.gstatic.com",
            "img-src 'self' data: blob: https://*.amazonaws.com https://*.cloudfront.net",
            "connect-src 'self' https://*.amazonaws.com",
            "media-src 'self' blob:",
            "worker-src 'self' blob:",
            "upgrade-insecure-requests",
          ].join('; '),
          override: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          preload: true,
          override: true,
        },
        xssProtection: { protection: true, modeBlock: true, override: true },
      },
      customHeadersBehavior: {
        customHeaders: [
          { header: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()', override: true },
          { header: 'Cross-Origin-Opener-Policy', value: 'same-origin', override: true },
        ],
      },
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        responseHeadersPolicy: browserSecurityHeaders,
      },
      additionalBehaviors: {
        'api/*': {
          origin: new origins.HttpOrigin(apiDomain, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          compress: true,
          responseHeadersPolicy: browserSecurityHeaders,
        },
      },
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: Duration.seconds(0) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: Duration.seconds(0) },
      ],
      enableIpv6: true,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    const publicBaseUrl = `https://${distribution.distributionDomainName}`;
    apiFunction.addEnvironment('PUBLIC_BASE_URL', publicBaseUrl);
    apiFunction.addEnvironment('ALLOWED_ORIGIN', publicBaseUrl);

    new cloudwatch.Alarm(this, 'ApiErrorAlarm', {
      metric: apiFunction.metricErrors({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'At least one Lambda error in five minutes. Review before relying on a demo decision.',
    });

    new cloudwatch.Alarm(this, 'ApiThrottleAlarm', {
      metric: apiFunction.metricThrottles({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Lambda throttling can force an evaluation into safe review/fallback behavior.',
    });

    new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
      metric: apiFunction.metricDuration({ statistic: 'p95', period: Duration.minutes(5) }),
      threshold: 20_000,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'p95 Lambda duration exceeded 20 seconds in two consecutive periods.',
    });

    Tags.of(this).add('Application', 'RedoReturnIntegrity');
    Tags.of(this).add('Stage', props.stage);
    Tags.of(this).add('DataClassification', 'SyntheticDemo');

    new CfnOutput(this, 'ApplicationUrl', {
      value: publicBaseUrl,
      description: 'Single-origin public demo URL. API requests use /api/*.',
    });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'WebBucketName', { value: webBucket.bucketName });
    new CfnOutput(this, 'UploadBucketName', { value: uploadBucket.bucketName });
    new CfnOutput(this, 'ApiEndpoint', { value: api.apiEndpoint });
    new CfnOutput(this, 'CaseTableName', { value: caseTable.tableName });
    new CfnOutput(this, 'WaitlistTableName', { value: waitlistTable.tableName });
    new CfnOutput(this, 'OpenAiSecretName', { value: 'OPENAI_API_KEY' });
  }
}
