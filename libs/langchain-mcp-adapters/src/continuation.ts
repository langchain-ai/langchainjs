/**
 * Suspend a tool call the server cannot finish without more input, and answer
 * it with a graph interrupt.
 *
 * A modern server needing input mid-call answers `tools/call` with an
 * `input_required` result and expects the call retried carrying the answers.
 * A *continuation* is that retry: the original request plus the answers it was
 * missing.
 *
 * The SDK can drive those rounds itself — `inputRequired.autoFulfill` answers
 * from registered elicitation handlers and retries through `flow.retry`. The
 * adapter deliberately does not use it. That driver fulfils every pending
 * request concurrently, `Promise.all` over `inputRequests`, while LangGraph
 * matches resume values to `interrupt()` calls by order, so answering from
 * those callbacks scrambles the matching. The Python adapter bypasses its
 * equivalent driver for the same reason. Driving the rounds here keeps one
 * `interrupt()` per round, raised from the frame that issued the call.
 *
 * Each round surfaces the server's questions as an `MCPElicitationInterrupt`
 * and resumes with `MCPElicitationResponses`, bounded by
 * `maxElicitationRounds` so a server cannot keep a run suspended forever.
 */
import {
  Client,
  CLIENT_CAPABILITIES_META_KEY,
  type CallToolRequest,
  type ElicitResult,
} from "@modelcontextprotocol/client";
import {
  CallToolRequestSchema,
  ClientCapabilitiesSchema,
} from "@modelcontextprotocol/core";
import { ns, LangChainError } from "@langchain/core/errors";
import { interrupt, type Interrupt } from "@langchain/langgraph";
import { z } from "zod";
import {
  CancellationObserverMCPClient,
  modernElicitationAnswerSchema,
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
export class InterruptMCPClient extends CancellationObserverMCPClient {
  readonly maxElicitationRounds: number;

  /**
   * Advertise in-band input on modern requests, per request.
   *
   * Not a declared capability: those are sent during initialization, before
   * negotiation settles the era, so an `auto` connection landing on legacy
   * would advertise elicitation to a server that must not see it.
   */
  protected override _outboundMetaEnvelope() {
    const envelope = super._outboundMetaEnvelope();
    if (this.getProtocolEra() !== "modern") {
      return envelope;
    }
    const capabilities = ClientCapabilitiesSchema.parse(
      envelope?.[CLIENT_CAPABILITIES_META_KEY] ?? {}
    );
    return {
      ...envelope,
      [CLIENT_CAPABILITIES_META_KEY]: {
        ...capabilities,
        elicitation: {
          form: capabilities.elicitation?.form ?? {},
          url: capabilities.elicitation?.url ?? {},
        },
      },
    };
  }

  constructor(
    info: ConstructorParameters<typeof Client>[0],
    options?: ConstructorParameters<typeof Client>[1],
    onCancelled?: ConstructorParameters<typeof CancellationObserverMCPClient>[2]
  ) {
    super(info, options, onCancelled);
    this.maxElicitationRounds = options?.inputRequired?.maxRounds ?? 32;
  }

  withInterrupts<T>(
    invoke: (continuation?: MCPContinuation) => Promise<T>,
    source: {
      server: string;
      tool: string;
      signal?: AbortSignal;
      /** No graph to interrupt, so questions are reported instead of asked. */
      direct?: boolean;
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
  inputResponses: MCPElicitationResponses;
  /** Echoed unchanged from the response this execution just received. */
  requestState?: PendingInput["requestState"];
}

/** User-facing questions only. Server continuation data never leaves the execution. */
const elicitationInterruptSchema = z.object({
  type: z.literal("mcp_elicitation"),
  server: z.string(),
  tool: z.string(),
  requests: z.record(z.string(), modernElicitationRequestSchema),
  validationError: z.string().optional(),
});

export type MCPElicitationInterrupt = z.output<
  typeof elicitationInterruptSchema
>;

const elicitationResponsesSchema = z.record(
  z.string(),
  modernElicitationAnswerSchema
);

/** Answers to one question set, keyed by the server's input-request keys. */
export type MCPElicitationResponses = z.output<
  typeof elicitationResponsesSchema
>;

/** Complete `Command.resume` value, keyed by the observed LangGraph interrupt ID. */
export type MCPElicitationResume = Record<
  string,
  { responses: MCPElicitationResponses }
>;

const elicitationTargetSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{32}$/, "Expected a LangGraph interrupt ID"),
  value: z.object({ type: z.literal("mcp_elicitation") }),
});

/**
 * Build a resume value aimed at one MCP question.
 *
 * Keying by the interrupt's own ID keeps answers from being delivered to an
 * unrelated interrupt that happens to be paused in the same run. It does not
 * make replayed server work idempotent, and it does not isolate arbitrary
 * `Promise.all` calls inside a single user node.
 */
export function createMCPElicitationResume(
  pending: Interrupt<unknown>,
  responses: MCPElicitationResponses
): MCPElicitationResume {
  const { id } = elicitationTargetSchema.parse(pending);
  return { [id]: { responses } };
}

type RoundResult<T> =
  | { kind: "complete"; value: T }
  | {
      kind: "pending";
      pending: PendingInput;
      request: CallToolRequest["params"];
    };

type MCPInvocationContext = {
  server: string;
  tool: string;
  maxRounds: number;
  /** No graph to interrupt, so questions are reported instead of asked. */
  direct?: boolean;
  signal?: AbortSignal;
};

/**
 * Drive elicitation rounds for one tool call, aligned with the Python adapter.
 *
 * The adapter owns no durable record of a round. When a graph resumes, the tool
 * node re-runs from the top: the initial `tools/call` is issued again, the
 * server answers with the same question, and `interrupt()` returns the answer
 * that was supplied instead of pausing. Only then is the answered follow-up
 * sent, carrying the `requestState` returned by the response this execution
 * just replayed — never a value saved from an earlier one.
 *
 * Consequences worth stating plainly: work the server performed before asking
 * runs again on resume, `beforeToolCall` runs again, and the adapter promises
 * no exactly-once effects. Servers and hooks must be replay-safe.
 */
export async function withMCPInterrupts<T>(
  invoke: (continuation?: MCPContinuation) => Promise<T>,
  source: MCPInvocationContext
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

    // An aborted call reports the abort, not the response it happened to get.
    source.signal?.throwIfAborted();

    if (round === source.maxRounds)
      throw new Error("MCP elicitation round limit exceeded");

    const elicitation = await elicitationInterruptSchema.parseAsync({
      type: "mcp_elicitation",
      server: source.server,
      tool: source.tool,
      requests: result.pending.inputRequests,
    });

    const { requests } = elicitation;

    const entries = Object.entries(requests);
    let responses: Record<string, ElicitResult> = {};

    if (entries.length > 0) {
      if (source.direct) {
        throw new ToolException(
          "This MCP tool requested user input. Invoke it inside a LangGraph with a checkpointer to pause and resume elicitation.",
          new PendingMCPInput(result.pending, result.request)
        );
      }

      const resumeSchema = z.strictObject({
        responses: z.strictObject(
          Object.fromEntries(
            entries.map(
              ([key, request]) =>
                [
                  key,
                  elicitationAnswerFor(request, modernElicitationAnswerSchema),
                ] satisfies [string, ReturnType<typeof elicitationAnswerFor>]
            )
          )
        ),
      });

      let question = elicitation;
      let answered = false;

      // Bounded like the server's rounds: a caller resuming with an invalid
      // answer would otherwise hold the run open forever.
      for (let attempt = 0; attempt <= source.maxRounds; attempt += 1) {
        const answer = await resumeSchema.safeParseAsync(interrupt(question));

        if (answer.success) {
          responses = answer.data.responses;
          answered = true;
          break;
        }

        question = {
          ...elicitation,
          validationError: z.prettifyError(answer.error),
        };
      }

      if (!answered) throw new Error("MCP elicitation answer limit exceeded");
    } else {
      // A state-only response carries no question, so nothing can advance it.
      // The adapter does not poll a server for completion.
      throw new ToolException(
        `MCP tool "${source.tool}" on server "${source.server}" returned a state-only continuation, which is not supported.`,
        new PendingMCPInput(result.pending, result.request)
      );
    }

    continuation = {
      request: result.request,
      inputResponses: responses,
      requestState: result.pending.requestState,
    };
  }

  throw new Error("MCP elicitation round limit exceeded");
}
