import { Client, type CallToolRequest } from "@modelcontextprotocol/client";
import { CallToolRequestSchema } from "@modelcontextprotocol/core";
import { ns, LangChainError } from "@langchain/core/errors";
import { z } from "zod";
import {
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
export class InterruptMCPClient extends Client {
  readonly maxElicitationRounds: number;

  constructor(...[info, options]: ConstructorParameters<typeof Client>) {
    super(info, options);
    this.maxElicitationRounds = options?.inputRequired?.maxRounds ?? 32;
  }

  withInterrupts<T>(
    invoke: (continuation?: MCPContinuation) => Promise<T>,
    source: {
      server: string;
      tool: string;
      signal?: AbortSignal;
    }
  ): Promise<T> {
    return withMCPInterrupts(invoke, {
      ...source,
      maxRounds: this.maxElicitationRounds,
    });
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

type RoundResult<T> =
  | { kind: "complete"; value: T }
  | {
      kind: "pending";
      pending: PendingInput;
      request: CallToolRequest["params"];
    };

/** Continue state-only responses without replaying the initial hook or losing call headers. */
export async function withMCPInterrupts<T>(
  invoke: (continuation?: MCPContinuation) => Promise<T>,
  source: {
    server: string;
    tool: string;
    maxRounds: number;
    signal?: AbortSignal;
  }
): Promise<T> {
  const invokeRound = async (
    continuation?: MCPContinuation
  ): Promise<RoundResult<T>> => {
    source.signal?.throwIfAborted();

    try {
      return { kind: "complete", value: await invoke(continuation) };
    } catch (error) {
      if (PendingMCPInput.isInstance(error)) {
        return {
          kind: "pending",
          pending: error.pending,
          request: error.request,
        };
      }

      throw error;
    }
  };

  let continuation: MCPContinuation | undefined;

  for (let round = 0; round <= source.maxRounds; round += 1) {
    source.signal?.throwIfAborted();
    const result = await invokeRound(continuation);

    if (result.kind === "complete") return result.value;

    if (round === source.maxRounds)
      throw new Error("MCP elicitation round limit exceeded");

    const elicitation = await elicitationInterruptSchema.parseAsync({
      type: "mcp_elicitation",
      server: source.server,
      tool: source.tool,
      requests: result.pending.inputRequests,
    });

    const { requests } = elicitation;

    if (Object.keys(requests).length > 0) {
      throw new ToolException(
        "This MCP tool requested user input, but no elicitation handler is available.",
        new PendingMCPInput(result.pending, result.request)
      );
    } else {
      // A state-only response is progress, not a user question. Avoid a tight polling loop.
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }

    continuation = {
      request: result.request,
      inputResponses: {},
      requestState: result.pending.requestState,
    };
  }

  throw new Error("MCP elicitation round limit exceeded");
}
