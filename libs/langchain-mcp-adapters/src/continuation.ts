import {
  Client,
  specTypeSchemas,
  type CallToolRequest,
  type ElicitResult,
} from "@modelcontextprotocol/client";
import { ns, LangChainError } from "@langchain/core/errors";
import { interrupt, task } from "@langchain/langgraph";
import { z } from "zod";
import {
  sdkSchema,
  elicitationAnswerSchema,
  modernElicitationRequestSchema,
  elicitationAnswerFor,
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
      execution?: "direct" | "graph";
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

    const request = await sdkSchema(specTypeSchemas.CallToolRequest).parseAsync(
      flow.request
    );

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
  elicitationAnswerSchema
);

export type MCPElicitationResume = z.output<typeof elicitationResponsesSchema>;

type RoundResult<T> =
  | { kind: "complete"; value: T }
  | {
      kind: "pending";
      pending: PendingInput;
      request: CallToolRequest["params"];
    };

/** Drive bounded continuation rounds; graph calls checkpoint each round before interrupting. */
export async function withMCPInterrupts<T>(
  invoke: (continuation?: MCPContinuation) => Promise<T>,
  source: {
    server: string;
    tool: string;
    maxRounds: number;
    execution?: "direct" | "graph";
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

  const callRound =
    source.execution === "direct"
      ? invokeRound
      : task(
          { name: "mcp.tool.round", retry: { maxAttempts: 1 } },
          invokeRound
        );

  let continuation: MCPContinuation | undefined;

  for (let round = 0; round <= source.maxRounds; round += 1) {
    source.signal?.throwIfAborted();
    const result = await callRound(continuation);

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

    const keys = Object.keys(requests);
    let responses: Record<string, ElicitResult> = {};

    if (keys.length > 0) {
      if (source.execution === "direct") {
        throw new ToolException(
          "This MCP tool requested user input. Invoke it inside a LangGraph with a checkpointer to pause and resume elicitation.",
          new PendingMCPInput(result.pending, result.request)
        );
      }

      const resumeSchema = z.strictObject(
        Object.fromEntries(
          keys.map(
            (key) =>
              [key, elicitationAnswerFor(requests[key])] satisfies [
                string,
                ReturnType<typeof elicitationAnswerFor>,
              ]
          )
        )
      );

      responses = await resumeSchema.parseAsync(interrupt(elicitation));
    } else {
      // A state-only response is progress, not a user question. Avoid a tight polling loop.
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }

    continuation = {
      request: result.request,
      inputResponses: responses,
      requestState: result.pending.requestState,
    };
  }

  throw new Error("MCP elicitation round limit exceeded");
}
