import {
  Client,
  specTypeSchemas,
  type CallToolRequest,
  type ElicitResult,
} from "@modelcontextprotocol/client";
import { interrupt, task } from "@langchain/langgraph";
import { z } from "zod";
import {
  sdkSchema,
  elicitationAnswerSchema,
  elicitationRequestSchema,
  elicitationAnswerFor,
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
  requests: z.record(z.string(), elicitationRequestSchema),
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
      const resumeSchema = z
        .record(z.string(), z.unknown())
        .check((ctx) => {
          if (
            Object.keys(ctx.value).length !== keys.length ||
            keys.some((key) => !Object.hasOwn(ctx.value, key))
          ) {
            ctx.issues.push({
              code: "custom",
              input: ctx.value,
              message:
                "MCP resume answers must match the pending request keys exactly",
            });
          }
        })
        .transform(async (answers, ctx) => {
          const parsed = await Promise.all(
            keys.map(async (key) => {
              const result = await elicitationAnswerFor(
                requests[key]
              ).safeParseAsync(answers[key]);
              if (result.success)
                return [key, result.data] satisfies [string, ElicitResult];
              for (const issue of result.error.issues)
                ctx.issues.push({
                  code: "custom",
                  message: issue.message,
                  input: answers[key],
                  path: [key, ...issue.path],
                });
              return undefined;
            })
          );
          if (ctx.issues.length) return z.NEVER;
          return Object.fromEntries(
            parsed.filter((entry) => entry !== undefined)
          );
        });
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
