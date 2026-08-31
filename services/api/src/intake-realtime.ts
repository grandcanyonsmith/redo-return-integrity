import { z } from "zod";
import type { OperatorSettings, PackageInspection, ReturnRecord } from "@return-integrity/domain";

export const DEFAULT_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime";

const clientSecretResponseSchema = z.object({
  value: z.string().min(10),
  expires_at: z.number().int().positive().optional(),
  session: z.object({ model: z.string().optional() }).partial().passthrough().optional(),
}).passthrough();

const centsToDollars = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

/**
 * System instructions for the test-mode resolution call. The realtime agent
 * plays the merchant's returns desk speaking with the customer; the same
 * human-approval guardrails as the rest of the intake apply.
 */
export const buildRealtimeCallInstructions = (
  returnRecord: ReturnRecord,
  inspection: PackageInspection | undefined,
  settings: OperatorSettings,
): string => {
  const findingLines = inspection
    ? [
        `Intake classification: ${inspection.classification.replaceAll("_", " ")} at ${Math.round(inspection.confidence * 100)}% confidence.`,
        `Finding summary: ${inspection.summary}`,
        `Refund recommendation: ${inspection.refund.recommendedType}${inspection.refund.recommendedAmountCents === null ? "" : ` of ${centsToDollars(inspection.refund.recommendedAmountCents)}`} (requires human approval).`,
      ]
    : ["No inspection is attached; keep the conversation to logistics and evidence gathering."];
  return [
    `You are the returns-desk voice agent for ${returnRecord.merchantName}, on a TEST-MODE resolution call for a warehouse return intake demo. No real customer is on the line.`,
    `Customer: ${returnRecord.customer.name}. Return ${returnRecord.rmaId}, order ${returnRecord.orderId}, product: ${returnRecord.product.title} (qty ${returnRecord.product.quantity}).`,
    `Return reason on file: ${returnRecord.return.reason}. Requested refund: ${centsToDollars(returnRecord.return.requestedRefundCents)} ${returnRecord.return.currency}.`,
    ...findingLines,
    "This is apparel. Talk about pieces, sizes, polybags, hang tags, and hygiene liners rather than units and serial numbers, and remember that ordering two sizes and keeping one is normal shopper behavior.",
    "Goals: explain what the warehouse observed, gather the customer's account of what they shipped, and agree on a next step (partial refund, ship a piece back, a new return label after a claim form, or supervisor review).",
    "Hard rules: never promise or move money — every settlement needs human approval; never accuse the customer of fraud; keep a neutral, factual, warm tone; offer a contest path for anything adverse; keep the call under three minutes; speak in short conversational turns.",
    `Preferred follow-up channel if one is needed: ${settings.defaultChannel === "SMS" ? "text message" : "email"}.`,
    "Close by summarizing the agreed next step and reminding the customer a written recap follows.",
  ].join("\n");
};

export interface MintRealtimeSecretInput {
  apiKey: string;
  sessionId: string;
  instructions: string;
  voice: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

export interface MintedRealtimeSecret {
  clientSecret: string;
  expiresAt: string | null;
  model: string;
}

/**
 * Mints a short-lived Realtime client secret (GA endpoint) so the browser can
 * open its own WebSocket to the OpenAI Realtime API without ever seeing the
 * real API key.
 */
export const mintRealtimeClientSecret = async (input: MintRealtimeSecretInput): Promise<MintedRealtimeSecret> => {
  const model = input.model ?? DEFAULT_REALTIME_MODEL;
  const result = await (input.fetchImpl ?? fetch)("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json",
      // Binds abuse attribution to the demo session without exposing it client-side.
      "openai-safety-identifier": `redo-intake-${input.sessionId}`,
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model,
        instructions: input.instructions,
        audio: { output: { voice: input.voice } },
      },
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!result.ok) throw new Error("REALTIME_SESSION_UNAVAILABLE");
  const parsed = clientSecretResponseSchema.parse(await result.json());
  return {
    clientSecret: parsed.value,
    expiresAt: parsed.expires_at ? new Date(parsed.expires_at * 1_000).toISOString() : null,
    model: parsed.session?.model ?? model,
  };
};
