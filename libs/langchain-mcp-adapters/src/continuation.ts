/**
 * Suspend a tool call the server cannot finish without more input.
 *
 * A modern server needing input mid-call answers `tools/call` with an
 * `input_required` result and expects the call to be retried carrying the
 * answers. A *continuation* is that retry: the original request plus the
 * answers it was missing.
 *
 * The SDK can drive those rounds itself — `inputRequired.autoFulfill` answers
 * from registered elicitation handlers and retries through `flow.retry`. The
 * adapter deliberately does not use it. That driver fulfils every pending
 * request concurrently, `Promise.all` over `inputRequests`, while LangGraph
 * matches resume values to `interrupt()` calls by order, so answering from
 * those callbacks scrambles the matching. The Python adapter bypasses its
 * equivalent driver for the same reason. Interception happens at the
 * invocation boundary instead, where rounds surface one at a time.
 *
 * This module is that boundary and nothing more. `InterruptMCPClient` turns a
 * non-complete result into `PendingMCPInput`, and `withMCPInterrupts` reports
 * it as a `ToolException` saying no handler is available. Raising the questions
 * as a graph interrupt and resuming with the answers builds on the
 * `MCPContinuation`, `MCPElicitationInterrupt` and `MCPElicitationResume`
 * shapes declared here, and lands in the graph elicitation layer.
 */
import { Client, type CallToolRequest } from "@modelcontextprotocol/client";
import { CallToolRequestSchema } from "@modelcontextprotocol/core";
import { ns, LangChainError } from "@langchain/core/errors";
import { z } from "zod";
import {
  CancellationObserverMCPClient,
  modernElicitationAnswerSchema,
  modernElicitationRequestSchema,
} from "./elicitation.js";
import { ToolException } from "./utils/errors.js";

type PendingInput = Parameters<Client["_resolveNonCompleteResult"]>[0];

export class PendingMCPInput extends ns
  .sub("mcp")
  .brand(LangChainError, "pending-input") {
  constructor(
    readonly pending: PendingInput,
    readonly request: CallToolRequest["params"]
  ) {
    super("MCP tool requires input");
  }
}

/** Keep callTool's header handling and output validation around each suspended response. */
export class InterruptMCPClient extends CancellationObserverMCPClient {
  withInterrupts<T>(
    invoke: (continuation?: MCPContinuation) => Promise<T>,
    source: {
      server: string;
      tool: string;
      signal?: AbortSignal;
    }
  ): Promise<T> {
    return withMCPInterrupts(invoke, source);
  }

  protected override async _resolveNonCompleteResult(
    ...[decoded, flow]: Parameters<Client["_resolveNonCompleteResult"]>
  ): Promise<unknown> {
    if (flow.request.method !== "tools/call") {
      return super._resolveNonCompleteResult(decoded, flow);
    }

    const request = CallToolRequestSchema.parse(flow.request);

    throw new PendingMCPInput(decoded, request.params);
  }
}

/** Recognize the execution capability without relying on SDK subclass identity. */
export function supportsMCPInterrupts(
  client: Client
): client is Client & Pick<InterruptMCPClient, "withInterrupts"> {
  return (
    "withInterrupts" in client && typeof client.withInterrupts === "function"
  );
}

export interface MCPContinuation {
  request: CallToolRequest["params"];
  inputResponses: MCPElicitationResume;
  requestState?: PendingInput["requestState"];
}

/** User-facing questions. Server continuation data stays in the checkpointed round. */
const elicitationInterruptSchema = z.object({
  type: z.literal("mcp_elicitation"),
  server: z.string(),
  tool: z.string(),
  requests: z.record(z.string(), modernElicitationRequestSchema),
});

export type MCPElicitationInterrupt = z.output<
  typeof elicitationInterruptSchema
>;

const elicitationResponsesSchema = z.record(
  z.string(),
  modernElicitationAnswerSchema
);

export type MCPElicitationResume = z.output<typeof elicitationResponsesSchema>;

/**
 * Surface an incomplete tool response at the invocation boundary.
 *
 * The adapter runs a tool call once. An `input_required` response cannot be
 * answered here: answering needs a LangGraph interrupt, which is why the
 * interception boundary exists at all. So this rejects with the pending
 * response attached rather than continuing the call itself.
 *
 * In particular a state-only response — `input_required` carrying no input
 * requests — is rejected instead of being retried. The adapter does not poll a
 * server for completion, and it makes no guarantee about reusing request state
 * across calls.
 */
export async function withMCPInterrupts<T>(
  invoke: (continuation?: MCPContinuation) => Promise<T>,
  source: {
    server: string;
    tool: string;
    signal?: AbortSignal;
  }
): Promise<T> {
  source.signal?.throwIfAborted();

  try {
    return await invoke();
  } catch (error) {
    if (!PendingMCPInput.isInstance(error)) throw error;

    // An aborted call reports the abort, not the response it happened to get.
    source.signal?.throwIfAborted();

    const { requests } = await elicitationInterruptSchema.parseAsync({
      type: "mcp_elicitation",
      server: source.server,
      tool: source.tool,
      requests: error.pending.inputRequests,
    });

    throw new ToolException(
      Object.keys(requests).length === 0
        ? `MCP tool "${source.tool}" on server "${source.server}" returned a state-only continuation, which is not supported.`
        : `MCP tool "${source.tool}" on server "${source.server}" requested user input, but no elicitation handler is available.`,
      error
    );
  }
}
