import { createHash } from "node:crypto";
import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeIntakeUpload,
  createIntakeUploadUrl,
  uploadSessionBinding,
} from "../src/uploads.js";

describe("intake evidence upload protocol", () => {
  const priorEnvironment = {
    bucket: process.env.UPLOAD_BUCKET_NAME,
    region: process.env.AWS_REGION,
    accessKey: process.env.AWS_ACCESS_KEY_ID,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY,
    profile: process.env.AWS_PROFILE,
  };
  const sessionId = "00000000-0000-4000-8000-000000000040";
  const otherSessionId = "00000000-0000-4000-8000-000000000099";
  const objectKey = "ephemeral/intake-return-label/00000000-0000-4000-8000-000000000777.png";
  const versionId = "immutable-version-demo-1";
  const png = Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    Buffer.from("synthetic-test-image-payload"),
  ]);
  const sha256 = createHash("sha256").update(png).digest("hex");
  const checksumBase64 = Buffer.from(sha256, "hex").toString("base64");

  beforeEach(() => {
    process.env.UPLOAD_BUCKET_NAME = "test-upload-bucket";
    process.env.AWS_REGION = "us-west-2";
    process.env.AWS_ACCESS_KEY_ID = "test-access-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";
    delete process.env.AWS_PROFILE;
  });

  afterEach(() => {
    const restore = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore("UPLOAD_BUCKET_NAME", priorEnvironment.bucket);
    restore("AWS_REGION", priorEnvironment.region);
    restore("AWS_ACCESS_KEY_ID", priorEnvironment.accessKey);
    restore("AWS_SECRET_ACCESS_KEY", priorEnvironment.secretKey);
    restore("AWS_PROFILE", priorEnvironment.profile);
    vi.restoreAllMocks();
  });

  const clientFor = (
    bytes: Uint8Array,
    options: {
      declaredSha?: string;
      metadataSessionId?: string;
      metadataPurpose?: "RETURN_LABEL" | "PACKAGE_CONTENTS";
      returnedVersionId?: string;
    } = {},
  ): { client: S3Client; send: ReturnType<typeof vi.fn> } => {
    const declaredSha = options.declaredSha ?? sha256;
    const returnedVersionId = options.returnedVersionId ?? versionId;
    const metadata = {
      sessionbinding: uploadSessionBinding(options.metadataSessionId ?? sessionId),
      purpose: options.metadataPurpose ?? "RETURN_LABEL",
      expectedsha256: declaredSha,
      expectedsizebytes: String(bytes.byteLength),
      synthetic: "false",
    };
    const client = new S3Client({
      region: "us-west-2",
      credentials: { accessKeyId: "test", secretAccessKey: "test" },
    });
    const send = vi.fn(async (command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        return {
          ContentLength: bytes.byteLength,
          ContentType: "image/png",
          Metadata: metadata,
          VersionId: returnedVersionId,
          ChecksumSHA256: Buffer.from(declaredSha, "hex").toString("base64"),
        };
      }
      if (command instanceof GetObjectCommand) {
        return {
          Body: { transformToByteArray: async () => bytes },
          ContentLength: bytes.byteLength,
          ContentType: "image/png",
          Metadata: metadata,
          VersionId: returnedVersionId,
          ChecksumSHA256: Buffer.from(declaredSha, "hex").toString("base64"),
        };
      }
      throw new Error("UNEXPECTED_COMMAND");
    });
    vi.spyOn(client as never, "send").mockImplementation(send as never);
    return { client, send };
  };

  it("issues a purpose-scoped random POST policy without exposing the raw session ID", async () => {
    const result = await createIntakeUploadUrl(sessionId, "RETURN_LABEL", {
      mimeType: "image/png",
      sizeBytes: png.byteLength,
      sha256,
    }) as {
      status: string;
      uploadUrl: string;
      objectKey: string;
      formFields: Record<string, string>;
    };

    expect(result.status).toBe("UPLOAD_URL_ISSUED_NOT_EVIDENCE");
    expect(result.objectKey).toMatch(/^ephemeral\/intake-return-label\/[a-f0-9-]{36}\.png$/);
    expect(JSON.stringify(result)).not.toContain(sessionId);
    expect(result.formFields).toMatchObject({
      "Content-Type": "image/png",
      "x-amz-checksum-algorithm": "SHA256",
      "x-amz-checksum-sha256": checksumBase64,
      "x-amz-meta-sessionbinding": uploadSessionBinding(sessionId),
      "x-amz-meta-purpose": "RETURN_LABEL",
      "x-amz-meta-expectedsizebytes": String(png.byteLength),
    });
    expect(result.formFields).not.toHaveProperty("x-amz-meta-sessionid");

    const encodedPolicy = result.formFields.Policy ?? result.formFields.policy;
    expect(encodedPolicy).toBeTruthy();
    const policy = JSON.parse(Buffer.from(encodedPolicy!, "base64").toString("utf8")) as {
      conditions: unknown[];
    };
    expect(policy.conditions).toContainEqual(["content-length-range", png.byteLength, png.byteLength]);
    expect(policy.conditions).toContainEqual(["eq", "$x-amz-checksum-sha256", checksumBase64]);
  });

  it("verifies the exact immutable version, binding, purpose, MIME, size, magic bytes, and checksum", async () => {
    const { client, send } = clientFor(png);
    const result = await completeIntakeUpload(sessionId, {
      objectKey,
      versionId,
      purpose: "RETURN_LABEL",
      sha256,
    }, new Date("2026-08-24T12:00:00.000Z"), client);

    expect(result.evidence).toMatchObject({
      sessionId,
      purpose: "RETURN_LABEL",
      objectKey,
      versionId,
      mimeType: "image/png",
      sizeBytes: png.byteLength,
      sha256,
      verifiedAt: "2026-08-24T12:00:00.000Z",
      expiresAt: "2026-08-25T12:00:00.000Z",
    });
    expect(result.evidence.evidenceId).toMatch(/^ev-upload-[a-f0-9]{32}$/);
    expect(result.previewUrl).toContain("versionId=immutable-version-demo-1");
    const head = send.mock.calls.find(([command]) => command instanceof HeadObjectCommand)?.[0] as HeadObjectCommand;
    const get = send.mock.calls.find(([command]) => command instanceof GetObjectCommand)?.[0] as GetObjectCommand;
    expect(head.input).toMatchObject({ VersionId: versionId, ChecksumMode: "ENABLED" });
    expect(get.input).toMatchObject({ VersionId: versionId, ChecksumMode: "ENABLED" });
  });

  it("is idempotent for the same key and immutable version", async () => {
    const first = await completeIntakeUpload(sessionId, {
      objectKey,
      versionId,
      purpose: "RETURN_LABEL",
      sha256,
    }, new Date("2026-08-24T12:00:00.000Z"), clientFor(png).client);
    const second = await completeIntakeUpload(sessionId, {
      objectKey,
      versionId,
      purpose: "RETURN_LABEL",
      sha256,
    }, new Date("2026-08-24T12:01:00.000Z"), clientFor(png).client);
    expect(second.evidence.evidenceId).toBe(first.evidence.evidenceId);
  });

  it("rejects a different session binding even though the key contains no session identifier", async () => {
    await expect(completeIntakeUpload(sessionId, {
      objectKey,
      versionId,
      purpose: "RETURN_LABEL",
      sha256,
    }, new Date(), clientFor(png, { metadataSessionId: otherSessionId }).client))
      .rejects.toThrow("UPLOAD_SESSION_MISMATCH");
  });

  it("rejects a response that does not resolve to the requested immutable version", async () => {
    await expect(completeIntakeUpload(sessionId, {
      objectKey,
      versionId,
      purpose: "RETURN_LABEL",
      sha256,
    }, new Date(), clientFor(png, { returnedVersionId: "different-version" }).client))
      .rejects.toThrow("UPLOAD_VERSION_MISMATCH");
  });

  it("rejects evidence whose signed purpose does not match the completion purpose", async () => {
    await expect(completeIntakeUpload(sessionId, {
      objectKey,
      versionId,
      purpose: "RETURN_LABEL",
      sha256,
    }, new Date(), clientFor(png, { metadataPurpose: "PACKAGE_CONTENTS" }).client))
      .rejects.toThrow("UPLOAD_PURPOSE_MISMATCH");
  });

  it("rejects content whose bytes do not match the declared image type", async () => {
    const text = Buffer.from("this is not a png");
    const textSha = createHash("sha256").update(text).digest("hex");
    await expect(completeIntakeUpload(sessionId, {
      objectKey,
      versionId,
      purpose: "RETURN_LABEL",
      sha256: textSha,
    }, new Date(), clientFor(text, { declaredSha: textSha }).client))
      .rejects.toThrow("UPLOAD_MAGIC_BYTES_MISMATCH");
  });
});
