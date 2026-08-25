import {
  McpServer,
  createMcpHandler,
  type CallToolResult,
  type McpHttpHandler,
} from "@modelcontextprotocol/server";
import {
  CommunicationDraftSchema,
  LabelLookupResultSchema,
  OperatorReviewRecordSchema,
  PackageInspectionSchema,
  TestOutboxMessageSchema,
} from "@return-integrity/domain";
import { z } from "zod";
import {
  DraftCommunicationInputSchema,
  LabelLookupInputSchema,
  PackageInspectionInputSchema,
  QueueCommunicationInputSchema,
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
      description: "Queue a human-reviewed draft in the delivery-disabled synthetic outbox. This tool never sends email or SMS.",
      inputSchema: QueueCommunicationInputSchema,
      outputSchema: QueueToolOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (args) => callToolSafely(() => service.queueTestCommunication(sessionId, args)),
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
