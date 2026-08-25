import { createHash, randomUUID } from "node:crypto";
import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import {
  CompletedIntakeEvidenceSchema,
  IntakeEvidencePurposeSchema,
  syntheticImageFixtures,
  type CompletedIntakeEvidence,
  type IntakeEvidencePurpose,
} from "@return-integrity/domain";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const extensions: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const client = new S3Client({});

const uploadPurposeSegment = (value: string): string => value.toLowerCase().replaceAll("_", "-");

/**
 * The anonymous session remains in the API/DynamoDB trust boundary. S3 sees
 * only this domain-separated one-way binding, never the bearer-like session ID.
 */
export const uploadSessionBinding = (sessionId: string): string => createHash("sha256")
  .update("redo-return-integrity:upload-session:v1\0", "utf8")
  .update(sessionId, "utf8")
  .digest("hex");

const sha256Base64 = (sha256Hex: string): string => Buffer.from(sha256Hex, "hex").toString("base64");

export interface UploadRequest {
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}

const validateUploadRequest = (input: UploadRequest): void => {
  if (!allowedMimeTypes.has(input.mimeType)) throw new Error("UNSUPPORTED_UPLOAD_TYPE");
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > 5 * 1024 * 1024) throw new Error("UPLOAD_SIZE_LIMIT");
  if (!/^[a-f0-9]{64}$/i.test(input.sha256)) throw new Error("INVALID_UPLOAD_CHECKSUM");
};

const createSignedUpload = async (
  sessionId: string,
  scopeId: string,
  input: UploadRequest,
  metadata: Record<string, string>,
): Promise<Record<string, unknown>> => {
  validateUploadRequest(input);
  const bucket = process.env.UPLOAD_BUCKET_NAME;
  if (!bucket) {
    return {
      status: "UPLOAD_DISABLED",
      message: "Ephemeral uploads are not configured in this environment. Select a synthetic fixture instead.",
      allowedFixtures: syntheticImageFixtures,
    };
  }
  const key = `ephemeral/${scopeId}/${randomUUID()}.${extensions[input.mimeType]}`;
  const fullMetadata = {
    expectedsha256: input.sha256.toLowerCase(),
    expectedsizebytes: String(input.sizeBytes),
    sessionbinding: uploadSessionBinding(sessionId),
    synthetic: "false",
    ...metadata,
  };
  const checksumSha256 = sha256Base64(input.sha256);
  const formFields = {
    "Content-Type": input.mimeType,
    "x-amz-checksum-algorithm": "SHA256",
    "x-amz-checksum-sha256": checksumSha256,
    "success_action_status": "201",
    ...Object.fromEntries(Object.entries(fullMetadata).map(([name, value]) => [`x-amz-meta-${name}`, value])),
  };
  const signedPost = await createPresignedPost(client, {
    Bucket: bucket,
    Key: key,
    Expires: 60,
    Fields: formFields,
    Conditions: [
      ["content-length-range", input.sizeBytes, input.sizeBytes],
      ["eq", "$Content-Type", input.mimeType],
      ["eq", "$x-amz-checksum-algorithm", "SHA256"],
      ["eq", "$x-amz-checksum-sha256", checksumSha256],
      { success_action_status: "201" },
      ...Object.entries(fullMetadata).map(([name, value]) => ({ [`x-amz-meta-${name}`]: value })),
    ],
  });
  return {
    status: "UPLOAD_URL_ISSUED_NOT_EVIDENCE",
    uploadUrl: signedPost.url,
    objectKey: key,
    formFields: signedPost.fields,
    expiresInSeconds: 60,
    retentionHours: 24,
    requirements: [
      "JPEG, PNG, or WebP only; maximum 5 MB",
      "Browser should re-encode the image before upload to strip EXIF metadata",
      "The signed POST policy fixes the object length to the declared byte count and binds the SHA-256 checksum",
      "The object is not evidence until completion verifies session binding, immutable S3 version, MIME magic bytes, size, and SHA-256",
    ],
  };
};

export const createUploadUrl = async (
  sessionId: string,
  caseId: string,
  input: UploadRequest,
): Promise<Record<string, unknown>> => {
  return createSignedUpload(sessionId, "case-evidence", input, { caseid: caseId });
};

export const createIntakeUploadUrl = async (
  sessionId: string,
  purpose: IntakeEvidencePurpose,
  input: UploadRequest,
): Promise<Record<string, unknown>> => createSignedUpload(
  sessionId,
  `intake-${uploadPurposeSegment(purpose)}`,
  input,
  { purpose: IntakeEvidencePurposeSchema.parse(purpose) },
);

export interface CompleteIntakeUploadInput {
  objectKey: string;
  versionId: string;
  purpose: IntakeEvidencePurpose;
  sha256: string;
}

const sniffImageMimeType = (bytes: Uint8Array): string | undefined => {
  if (bytes.length >= 8 && Buffer.from(bytes.subarray(0, 8)).toString("hex") === "89504e470d0a1a0a") return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12
    && Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF"
    && Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP") return "image/webp";
  return undefined;
};

export const completeIntakeUpload = async (
  sessionId: string,
  rawInput: CompleteIntakeUploadInput,
  now = new Date(),
  s3Client: S3Client = client,
): Promise<{ evidence: CompletedIntakeEvidence; previewUrl: string }> => {
  const input = {
    objectKey: rawInput.objectKey,
    versionId: rawInput.versionId.trim(),
    purpose: IntakeEvidencePurposeSchema.parse(rawInput.purpose),
    sha256: rawInput.sha256.toLowerCase(),
  };
  if (!/^[a-f0-9]{64}$/.test(input.sha256)) throw new Error("INVALID_UPLOAD_CHECKSUM");
  if (!input.versionId || input.versionId === "null" || input.versionId.length > 1_024) throw new Error("UPLOAD_VERSION_REQUIRED");
  const prefix = `ephemeral/intake-${uploadPurposeSegment(input.purpose)}/`;
  if (!input.objectKey.startsWith(prefix) || input.objectKey.includes("..")) throw new Error("UPLOAD_PURPOSE_MISMATCH");
  const bucket = process.env.UPLOAD_BUCKET_NAME;
  if (!bucket) throw new Error("UPLOAD_DISABLED");

  const expectedChecksumBase64 = sha256Base64(input.sha256);
  const expectedSessionBinding = uploadSessionBinding(sessionId);
  const head = await s3Client.send(new HeadObjectCommand({
    Bucket: bucket,
    Key: input.objectKey,
    VersionId: input.versionId,
    ChecksumMode: "ENABLED",
  }));
  const sizeBytes = Number(head.ContentLength ?? 0);
  const mimeType = head.ContentType ?? "";
  const metadata = head.Metadata ?? {};
  if (head.VersionId !== input.versionId) throw new Error("UPLOAD_VERSION_MISMATCH");
  if (metadata.sessionbinding !== expectedSessionBinding) throw new Error("UPLOAD_SESSION_MISMATCH");
  if (metadata.purpose !== input.purpose) throw new Error("UPLOAD_PURPOSE_MISMATCH");
  if (metadata.expectedsha256 !== input.sha256) throw new Error("INVALID_UPLOAD_CHECKSUM");
  if (head.ChecksumSHA256 !== expectedChecksumBase64) throw new Error("INVALID_UPLOAD_CHECKSUM");
  if (Number(metadata.expectedsizebytes ?? 0) !== sizeBytes) throw new Error("UPLOAD_SIZE_MISMATCH");
  validateUploadRequest({ mimeType, sizeBytes, sha256: input.sha256 });

  const object = await s3Client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: input.objectKey,
    VersionId: input.versionId,
    ChecksumMode: "ENABLED",
  }));
  if (object.VersionId !== input.versionId) throw new Error("UPLOAD_VERSION_MISMATCH");
  if (object.ChecksumSHA256 !== expectedChecksumBase64) throw new Error("INVALID_UPLOAD_CHECKSUM");
  if (object.ContentType !== mimeType || Number(object.ContentLength ?? 0) !== sizeBytes) throw new Error("UPLOAD_SIZE_MISMATCH");
  if (object.Metadata?.sessionbinding !== expectedSessionBinding || object.Metadata?.purpose !== input.purpose) {
    throw new Error("UPLOAD_SESSION_MISMATCH");
  }
  const bytes = object.Body ? await object.Body.transformToByteArray() : undefined;
  if (!bytes || bytes.byteLength !== sizeBytes) throw new Error("UPLOAD_SIZE_MISMATCH");
  if (sniffImageMimeType(bytes) !== mimeType) throw new Error("UPLOAD_MAGIC_BYTES_MISMATCH");
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  if (actualSha256 !== input.sha256) throw new Error("INVALID_UPLOAD_CHECKSUM");

  const evidence = CompletedIntakeEvidenceSchema.parse({
    evidenceId: `ev-upload-${createHash("sha256").update(`${input.objectKey}\0${input.versionId}`).digest("hex").slice(0, 32)}`,
    sessionId,
    purpose: input.purpose,
    objectKey: input.objectKey,
    versionId: input.versionId,
    mimeType,
    sizeBytes,
    sha256: actualSha256,
    verifiedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1_000).toISOString(),
  });
  return {
    evidence,
    previewUrl: await getSignedUrl(s3Client, new GetObjectCommand({
      Bucket: bucket,
      Key: input.objectKey,
      VersionId: input.versionId,
    }), { expiresIn: 300 }),
  };
};

export const getEvidenceObjectUrl = async (objectKey: string, versionId: string): Promise<string | undefined> => {
  const bucket = process.env.UPLOAD_BUCKET_NAME;
  if (!bucket || !objectKey.startsWith("ephemeral/") || !versionId || versionId === "null") return undefined;
  return getSignedUrl(client, new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    VersionId: versionId,
  }), { expiresIn: 300 });
};
