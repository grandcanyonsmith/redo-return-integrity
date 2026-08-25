import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { syntheticImageFixtures } from "@return-integrity/domain";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const extensions: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const client = new S3Client({});

export interface UploadRequest {
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}

export const createUploadUrl = async (
  sessionId: string,
  caseId: string,
  input: UploadRequest,
): Promise<Record<string, unknown>> => {
  if (!allowedMimeTypes.has(input.mimeType)) throw new Error("UNSUPPORTED_UPLOAD_TYPE");
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > 5 * 1024 * 1024) throw new Error("UPLOAD_SIZE_LIMIT");
  if (!/^[a-f0-9]{64}$/i.test(input.sha256)) throw new Error("INVALID_UPLOAD_CHECKSUM");
  const bucket = process.env.UPLOAD_BUCKET_NAME;
  if (!bucket) {
    return {
      status: "UPLOAD_DISABLED",
      message: "Ephemeral uploads are not configured in this environment. Select a synthetic fixture instead.",
      allowedFixtures: syntheticImageFixtures,
    };
  }
  const key = `ephemeral/${sessionId}/${caseId}/${randomUUID()}.${extensions[input.mimeType]}`;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: input.mimeType,
    Metadata: {
      expectedsha256: input.sha256.toLowerCase(),
      sessionid: sessionId,
      caseid: caseId,
      synthetic: "false",
    },
  });
  return {
    status: "UPLOAD_URL_ISSUED_NOT_EVIDENCE",
    uploadUrl: await getSignedUrl(client, command, { expiresIn: 300 }),
    objectKey: key,
    requiredHeaders: {
      "content-type": input.mimeType,
      "x-amz-meta-expectedsha256": input.sha256.toLowerCase(),
      "x-amz-meta-sessionid": sessionId,
      "x-amz-meta-caseid": caseId,
      "x-amz-meta-synthetic": "false",
    },
    expiresInSeconds: 300,
    retentionHours: 24,
    requirements: [
      "JPEG, PNG, or WebP only; maximum 5 MB",
      "Browser must re-encode the image before upload to strip EXIF metadata",
      "Do not upload government ID, a real customer shipping label, or unrelated personal data",
      "The object is not decision evidence until a completion check verifies MIME magic bytes and checksum",
    ],
  };
};

export const getEvidenceObjectUrl = async (objectKey: string): Promise<string | undefined> => {
  const bucket = process.env.UPLOAD_BUCKET_NAME;
  if (!bucket || !objectKey.startsWith("ephemeral/")) return undefined;
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: objectKey }), { expiresIn: 300 });
};
