import {
  Client,
  specTypeSchemas,
  type CallToolRequest,
  type ElicitResult,
} from "@modelcontextprotocol/client";
import { interrupt, task } from "@langchain/langgraph";
import { z } from "zod";
import {
  validateElicitationAnswer,
  type MCPElicitationRequest,
} from "./elicitation.js";

type PendingInput = Parameters<Client["_resolveNonCompleteResult"]>[0];

export class PendingMCPInput extends Error {
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

  protected override _resolveNonCompleteResult(
    ...[decoded, flow]: Parameters<Client["_resolveNonCompleteResult"]>
  ): Promise<unknown> {
    if (flow.request.method !== "tools/call") {
      return super._resolveNonCompleteResult(decoded, flow);
    }

    const parsed = specTypeSchemas.CallToolRequest["~standard"].validate(
      flow.request
    );

    if (parsed.issues)
      return Promise.reject(new Error("Invalid suspended MCP tool request"));

    return Promise.reject(new PendingMCPInput(decoded, parsed.value.params));
  }
}

export interface MCPContinuation {
  request: CallToolRequest["params"];
  inputResponses: Record<string, ElicitResult>;
  requestState?: string;
}

/** User-facing questions. Server continuation data stays in the checkpointed round. */
export interface MCPElicitationInterrupt {
  type: "mcp_elicitation";
  server: string;
  tool: string;
  requests: Record<string, MCPElicitationRequest>;
}

export type MCPElicitationResume = Record<string, ElicitResult>;

type RoundResult<T> =
  | { kind: "complete"; value: T }
  | {
      kind: "pending";
      pending: PendingInput;
      request: CallToolRequest["params"];
    };

/** Checkpoint wire rounds, keeping opaque continuation state out of interrupt values. */
export async function withMCPInterrupts<T>(
  invoke: (continuation?: MCPContinuation) => Promise<T>,
  source: {
    server: string;
    tool: string;
    maxRounds: number;
    signal?: AbortSignal;
  }
): Promise<T> {
  const callRound = task(
    { name: "mcp.tool.round", retry: { maxAttempts: 1 } },
    async (continuation?: MCPContinuation): Promise<RoundResult<T>> => {
      source.signal?.throwIfAborted();

      try {
        return { kind: "complete", value: await invoke(continuation) };
      } catch (error) {
        if (error instanceof PendingMCPInput) {
          return {
            kind: "pending",
            pending: error.pending,
            request: error.request,
          };
        }

        throw error;
      }
    }
  );

  let continuation: MCPContinuation | undefined;

  for (let round = 0; round <= source.maxRounds; round += 1) {
    source.signal?.throwIfAborted();
    const result = await callRound(continuation);

    if (result.kind === "complete") return result.value;

    if (round === source.maxRounds)
      throw new Error("MCP elicitation round limit exceeded");

    const requests = Object.fromEntries(
      Object.entries(result.pending.inputRequests).map(([key, value]) => {
        const parsed =
          specTypeSchemas.ElicitRequest["~standard"].validate(value);

        if (parsed.issues)
          throw new Error(
            "Only elicitation is supported by MCP graph interrupts"
          );

        return [key, parsed.value.params] satisfies [
          string,
          MCPElicitationRequest,
        ];
      })
    );

    const keys = Object.keys(requests);
    let responses: Record<string, ElicitResult> = {};

    if (keys.length > 0) {
      const answer = z.record(z.string(), z.unknown()).parse(
        interrupt({
          type: "mcp_elicitation",
          server: source.server,
          tool: source.tool,
          requests,
        } satisfies MCPElicitationInterrupt)
      );

      if (
        Object.keys(answer).length !== keys.length ||
        keys.some((key) => !Object.hasOwn(answer, key))
      ) {
        throw new Error(
          "MCP resume answers must match the pending request keys exactly"
        );
      }

      responses = Object.fromEntries(
        await Promise.all(
          keys.map(
            async (key) =>
              [
                key,
                await validateElicitationAnswer(requests[key], answer[key]),
              ] satisfies [string, ElicitResult]
          )
        )
      );
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
