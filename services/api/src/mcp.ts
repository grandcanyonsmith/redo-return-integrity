import {
  McpServer,
  createMcpHandler,
  type CallToolResult,
  type McpHttpHandler,
} from "@modelcontextprotocol/server";
import {
  CommunicationDraftSchema,
  IntakeActivityRecordSchema,
  IntakeCallRecordSchema,
  IntakeDispositionRecordSchema,
  LabelLookupResultSchema,
  OperatorReviewRecordSchema,
  PackageInspectionSchema,
  RefundPortfolioQuerySchema,
  RefundPortfolioSchema,
  TestOutboxMessageSchema,
} from "@return-integrity/domain";
import { z } from "zod";
import {
  DraftCommunicationInputSchema,
  LabelLookupInputSchema,
  PackageInspectionInputSchema,
  QueueCommunicationInputSchema,
  RecordCallOutcomeInputSchema,
  RecordDispositionInputSchema,
  RecordReturnReviewInputSchema,
  type ReturnIntakeService,
} from "./intake-service.js";

// The v2 handler's modern per-request era. The SDK's LATEST_PROTOCOL_VERSION
// export intentionally names its latest 2025 handshake-compatible revision,
// so it is not the right constant for this modern Streamable HTTP surface.
export const MCP_PROTOCOL_VERSION = "2026-07-28";
export const MCP_SERVER_NAME = "redo-return-integrity";
export const MCP_SERVER_VERSION = "0.3.0";

// This header exists only on the in-process Request handed to the SDK. The
// Lambda adapter always overwrites any caller-supplied value with the session
// it has already validated against the application store.
export const MCP_VERIFIED_SESSION_HEADER = "x-redo-verified-demo-session";

const InspectionToolOutputSchema = z.object({
  mode: z.enum(["OPENAI", "SYNTHETIC_FIXTURE", "SAFE_FALLBACK"]),
  inspection: PackageInspectionSchema,
});
const DraftToolOutputSchema = z.object({ draft: CommunicationDraftSchema });
const ReviewToolOutputSchema = z.object({ review: OperatorReviewRecordSchema });
const QueueToolOutputSchema = z.object({
  status: z.literal("QUEUED_TEST_OUTBOX"),
  messageId: z.string().min(1).max(120),
  deliveryDisabled: z.literal(true),
  message: TestOutboxMessageSchema,
  activity: IntakeActivityRecordSchema.optional(),
});
const ActivityListToolOutputSchema = z.object({
  activity: z.array(IntakeActivityRecordSchema).max(100),
});
const ActivityListInputSchema = z.object({});
const DispositionToolOutputSchema = z.object({
  record: IntakeDispositionRecordSchema,
  activity: IntakeActivityRecordSchema.optional(),
});
const CallOutcomeToolOutputSchema = z.object({
  call: IntakeCallRecordSchema,
  activity: IntakeActivityRecordSchema,
});

const safeToolErrorCode = (error: unknown): string => {
  if (error instanceof z.ZodError) return "INVALID_TOOL_ARGUMENTS";
  const message = error instanceof Error ? error.message : "";
  return /^[A-Z][A-Z0-9_]{2,79}$/.test(message) ? message : "TOOL_EXECUTION_FAILED";
};

const callToolSafely = async (operation: () => Promise<unknown>): Promise<CallToolResult> => {
  try {
    const output = await operation();
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output,
      isError: false,
    };
  } catch (error) {
    const code = safeToolErrorCode(error);
    const structuredContent = {
      error: {
        code,
        message: code === "INVALID_TOOL_ARGUMENTS"
          ? "The tool arguments did not match the documented contract."
          : code === "TOOL_EXECUTION_FAILED"
            ? "The tool could not be completed safely."
            : "The requested tool operation was rejected safely.",
      },
    };
    return {
      content: [{ type: "text", text: JSON.stringify(structuredContent) }],
      structuredContent,
      isError: true,
    };
  }
};

export const createReturnIntakeMcpServer = (
  service: ReturnIntakeService,
  sessionId: string,
): McpServer => {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    {
      instructions: [
        "Evidence-assessment tools for a synthetic return-intake demonstration.",
        "Monetary outputs are deterministic recommendations that require human approval.",
        "Communication queueing is test-only and delivery-disabled.",
      ].join(" "),
      cacheHints: {
        "tools/list": { ttlMs: 0, cacheScope: "private" },
        "server/discover": { ttlMs: 0, cacheScope: "private" },
      },
    },
  );

  server.registerTool(
    "lookup_return_by_label",
    {
      title: "Look up return by label",
      description: "Extract privacy-minimized routing identifiers from completed label evidence, or accept a bounded direct identifier or synthetic fixture, and look up the matching return record.",
      inputSchema: LabelLookupInputSchema,
      outputSchema: LabelLookupResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    (args) => callToolSafely(() => service.lookupReturnByLabel(sessionId, args)),
  );

  server.registerTool(
    "analyze_return_contents",
    {
      title: "Analyze return contents",
      description: "Compare completed warehouse package evidence or a synthetic fixture with the authorized SKU and quantity, then compute a bounded human-review refund recommendation.",
      inputSchema: PackageInspectionInputSchema,
      outputSchema: InspectionToolOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    (args) => callToolSafely(() => service.analyzeReturnContents(sessionId, args)),
  );

  server.registerTool(
    "draft_return_communication",
    {
      title: "Draft return communication",
      description: "Draft neutral shopper email or SMS copy with catalog-reference and warehouse-evidence provenance. This tool never sends the draft.",
      inputSchema: DraftCommunicationInputSchema,
      outputSchema: DraftToolOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    (args) => callToolSafely(() => service.draftReturnCommunication(sessionId, args)),
  );

  server.registerTool(
    "record_return_review",
    {
      title: "Record return review",
      description: "Persist an unauthenticated demo operator display label and explicit approval of the exact recommendation, policy, draft content, and complete inspection evidence set. This tool does not establish identity or send a message.",
      inputSchema: RecordReturnReviewInputSchema,
      outputSchema: ReviewToolOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    (args) => callToolSafely(() => service.recordReturnReview(sessionId, args)),
  );

  server.registerTool(
    "queue_test_communication",
    {
      title: "Queue test communication",
      description: "Queue a human-reviewed draft in the delivery-disabled synthetic outbox and record the session's intake activity/resolution status. This tool never sends email or SMS.",
      inputSchema: QueueCommunicationInputSchema,
      outputSchema: QueueToolOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (args) => callToolSafely(() => service.queueTestCommunication(sessionId, args)),
  );

  server.registerTool(
    "list_intake_activity",
    {
      title: "List intake activity",
      description: "List this session's completed intake activity records, newest first. A fresh session returns an empty list.",
      inputSchema: ActivityListInputSchema,
      outputSchema: ActivityListToolOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    () => callToolSafely(() => service.listIntakeActivity(sessionId)),
  );

  server.registerTool(
    "list_refund_portfolio",
    {
      title: "List refund portfolio",
      description: "List the seeded warehouse refund book for the station dashboard and board, overlaid with this session's live intake activity. Optional from/to calendar days filter last activity.",
      inputSchema: RefundPortfolioQuerySchema,
      outputSchema: RefundPortfolioSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (args) => callToolSafely(() => service.listRefundPortfolio(sessionId, args)),
  );

  server.registerTool(
    "record_intake_disposition",
    {
      title: "Record intake disposition",
      description: "Persist the operator-confirmed post-photo triage decision (pass, take more photos, or set aside). SET_ASIDE also records a resolution activity entry for the session feed.",
      inputSchema: RecordDispositionInputSchema,
      outputSchema: DispositionToolOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    (args) => callToolSafely(() => service.recordIntakeDisposition(sessionId, args)),
  );

  server.registerTool(
    "record_call_outcome",
    {
      title: "Record call outcome",
      description: "Persist the outcome of a completed test-mode customer resolution call (OpenAI Realtime over WebSocket, or the deterministic simulated console): transcript digest, duration, resolution, and the session activity/status entry. This system never places a real telephone call.",
      inputSchema: RecordCallOutcomeInputSchema,
      outputSchema: CallOutcomeToolOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    (args) => callToolSafely(() => service.recordCallOutcome(sessionId, args)),
  );

  return server;
};

export const createReturnIntakeMcpHandler = (
  service: ReturnIntakeService,
): McpHttpHandler => createMcpHandler(
  ({ requestInfo }) => {
    const sessionId = requestInfo?.headers.get(MCP_VERIFIED_SESSION_HEADER);
    if (!sessionId || !/^[a-f0-9-]{36}$/i.test(sessionId)) throw new Error("SESSION_NOT_FOUND");
    return createReturnIntakeMcpServer(service, sessionId);
  },
  {
    // Every request gets a fresh SDK server/transport. No MCP session state,
    // resumability, GET event stream, or server-to-client request is retained.
    legacy: "stateless",
    responseMode: "json",
    maxSubscriptions: 0,
    keepAliveMs: 0,
  },
);
