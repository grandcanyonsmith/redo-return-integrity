import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

let cachedOpenAIKey: string | undefined;
let pendingOpenAIKey: Promise<string | undefined> | undefined;

const parseSecret = (secret: string): string | undefined => {
  if (secret.startsWith("sk-")) return secret;
  try {
    const parsed = JSON.parse(secret) as Record<string, unknown>;
    const candidate = parsed.OPENAI_API_KEY ?? parsed.apiKey ?? parsed.key;
    return typeof candidate === "string" && candidate.length > 0 ? candidate : undefined;
  } catch {
    return secret.length > 0 ? secret : undefined;
  }
};

export const resolveOpenAIKey = async (): Promise<string | undefined> => {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  if (cachedOpenAIKey) return cachedOpenAIKey;
  if (pendingOpenAIKey) return pendingOpenAIKey;
  const secretId = process.env.OPENAI_SECRET_NAME;
  if (!secretId) return undefined;
  pendingOpenAIKey = new SecretsManagerClient({}).send(new GetSecretValueCommand({ SecretId: secretId }))
    .then((result) => {
      const raw = result.SecretString ?? (result.SecretBinary ? Buffer.from(result.SecretBinary).toString("utf8") : undefined);
      cachedOpenAIKey = raw ? parseSecret(raw) : undefined;
      return cachedOpenAIKey;
    })
    .catch(() => undefined)
    .finally(() => { pendingOpenAIKey = undefined; });
  return pendingOpenAIKey;
};

export const clearSecretCacheForTests = (): void => {
  cachedOpenAIKey = undefined;
  pendingOpenAIKey = undefined;
};
