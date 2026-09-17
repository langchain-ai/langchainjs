import { z } from "zod";
import {
  Client,
  CLIENT_CAPABILITIES_META_KEY,
  fromJsonSchema,
  type CallToolRequest,
  type CallToolResult,
  type CancelledNotificationParams,
  type ElicitRequest,
  type ElicitResult,
  type JSONRPCNotification,
  type MessageExtraInfo,
} from "@modelcontextprotocol/client";
import {
  CallToolRequestSchema,
  CancelledNotificationParamsSchema,
  ClientCapabilitiesSchema,
  ElicitRequestFormParamsSchema,
  ElicitRequestSchema,
  ElicitRequestURLParamsSchema,
  ElicitResultSchema,
} from "@modelcontextprotocol/core";
import { DefaultJsonSchemaValidator } from "@modelcontextprotocol/client/_shims";
import { ns, LangChainError } from "@langchain/core/errors";
import { interrupt, type Interrupt } from "@langchain/langgraph";
import { MCPClientError, ToolException } from "./utils/errors.js";

/** Observe validated cancellations without replacing the SDK handler. */
export class CancellationObserverMCPClient extends Client {
  constructor(
    info: ConstructorParameters<typeof Client>[0],
    options: ConstructorParameters<typeof Client>[1],
    private readonly onCancelled?: (
      notification: CancelledNotificationParams
    ) => void | Promise<void>
  ) {
    super(info, options);
  }

  protected override _onnotification(
    notification: JSONRPCNotification,
    extra?: MessageExtraInfo
  ): void {
    // The SDK aborts the in-flight request from this notification. Dispatch it
    // first so observing a cancellation can never suppress that.
    super._onnotification(notification, extra);

    if (notification.method !== "notifications/cancelled") return;

    const parsed = CancelledNotificationParamsSchema.safeParse(
      notification.params
    );
    if (
      !parsed.success ||
      (this.getProtocolEra() === "modern" &&
        parsed.data.requestId === undefined)
    )
      return;

    try {
      Promise.resolve(this.onCancelled?.(parsed.data)).catch(() => {});
    } catch {
      // Observer failures must not affect SDK cancellation dispatch.
    }
  }
}

export const elicitationAnswerSchema = ElicitResultSchema;

export const modernElicitationAnswerSchema = ElicitResultSchema.pick({
  action: true,
  content: true,
}).strip();

// Keep the modern question fields from the SDK's legacy-compatible schemas.
const modernFormRequestSchema = ElicitRequestFormParamsSchema.pick({
  mode: true,
  message: true,
  requestedSchema: true,
});

const modernURLRequestSchema = ElicitRequestURLParamsSchema.pick({
  mode: true,
  message: true,
  url: true,
});

export const modernElicitationRequestSchema = ElicitRequestSchema.extend({
  params: z.union([modernFormRequestSchema, modernURLRequestSchema]),
}).transform((request) => request.params);

type ModernElicitationRequest = z.output<typeof modernElicitationRequestSchema>;

/** SDK-owned form or URL request. The application owns presentation. */
export type MCPElicitationRequest = ElicitRequest["params"];

export type MCPElicitationAnswer = ElicitResult;

export interface MCPElicitationContext {
  /** Configured server name. */
  server: string;
  /** Aborted when the originating request is cancelled. */
  signal: AbortSignal;
}

export type MCPElicitationHandler = (
  request: MCPElicitationRequest,
  context: MCPElicitationContext
) => MCPElicitationAnswer | Promise<MCPElicitationAnswer>;

/** Parse application answers without duplicating the protocol's schemas. */
export function elicitationAnswerFor(
  request: MCPElicitationRequest | ModernElicitationRequest,
  schema: z.ZodType<ElicitResult> = elicitationAnswerSchema
) {
  return schema.check(async (ctx) => {
    const answer = ctx.value;

    if (request.mode === "url") {
      if (answer.content !== undefined) {
        ctx.issues.push({
          code: "custom",
          input: answer,
          path: ["content"],
          message: "URL elicitation answers cannot contain form content",
        });
      }
    } else if (answer.action === "accept") {
      // Keep schema IDs isolated while using the SDK's runtime-selected validator.
      const validator = fromJsonSchema(
        request.requestedSchema,
        new DefaultJsonSchemaValidator()
      );

      const parsed = await validator["~standard"].validate(
        answer.content ?? {}
      );

      if (parsed.issues) {
        for (const issue of parsed.issues) {
          ctx.issues.push({
            code: "custom",
            message: issue.message,
            input: answer.content,
            path: [
              "content",
              ...(issue.path?.map((segment) =>
                typeof segment === "object" ? segment.key : segment
              ) ?? []),
            ],
          });
        }
      }
    }
  });
}

/** Parse application input using the SDK result contract and the requested form. */
export function validateElicitationAnswer(
  request: MCPElicitationRequest,
  input: unknown
): Promise<MCPElicitationAnswer> {
  return elicitationAnswerFor(request).parseAsync(input);
}

/** Install before connect, so capabilities and handlers agree during negotiation. */
export function configureElicitation(
  client: Client,
  server: string,
  handler?: MCPElicitationHandler
): void {
  if (!handler) return;

  client.setRequestHandler("elicitation/create", async (request, context) => {
    const { signal } = context.mcpReq;
    signal.throwIfAborted();
    const answer = await handler(request.params, { server, signal });
    signal.throwIfAborted();

    return validateElicitationAnswer(request.params, answer);
  });
}

type PendingInput = Parameters<Client["_resolveNonCompleteResult"]>[0];

/**
 * A modern `input_required` response, raised so it escapes `callTool`.
 *
 * Thrown rather than returned deliberately: `callTool` validates results
 * against the tool's output schema, and a non-complete response carries no
 * structured content. Throwing carries it past that validator while terminal
 * results still go through it.
 */
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

/**
 * Fallback when a client is built without the SDK's `inputRequired` options.
 *
 * Connections the adapter builds always carry a budget, so this only applies to
 * a directly constructed client. Keep it aligned with the
 * `maxElicitationRounds` default in the connection schema.
 */
const DEFAULT_ELICITATION_ROUNDS = 32;

/**
 * Surface modern `input_required` responses instead of auto-answering them.
 *
 * The SDK drives these rounds itself, and for a callback-shaped consumer that
 * is the right answer: register an `elicitation/create` handler and let the
 * driver retry. It cannot work here. The driver fulfils every pending request
 * concurrently, LangGraph matches resume values to `interrupt()` calls by
 * order, and `interrupt()` suspends by throwing, which the driver would read as
 * a handler failure. Rounds are therefore driven from the frame that issued the
 * call, one question at a time. The Python adapter bypasses its own driver for
 * the same reasons.
 *
 * `_resolveNonCompleteResult` is the SDK's own seam for manual handling, so
 * intercepting there keeps what `callTool` wraps around the response: SEP-2243
 * `Mcp-Param-*` header mirroring and output-schema validation.
 */
export class InterruptMCPClient extends CancellationObserverMCPClient {
  readonly maxElicitationRounds: number;

  constructor(
    info: ConstructorParameters<typeof Client>[0],
    options?: ConstructorParameters<typeof Client>[1],
    onCancelled?: ConstructorParameters<typeof CancellationObserverMCPClient>[2]
  ) {
    super(info, options, onCancelled);
    this.maxElicitationRounds =
      options?.inputRequired?.maxRounds ?? DEFAULT_ELICITATION_ROUNDS;
  }

  /**
   * Advertise in-band input on modern requests, per request.
   *
   * Not a declared capability: those are sent during initialization, before
   * negotiation settles the era, so an `auto` connection landing on legacy
   * would advertise elicitation to a server that must not see it.
   */
  protected override _outboundMetaEnvelope() {
    const envelope = super._outboundMetaEnvelope();
    if (this.getProtocolEra() !== "modern") return envelope;

    const capabilityKey = CLIENT_CAPABILITIES_META_KEY;
    const capabilities = ClientCapabilitiesSchema.parse(
      envelope?.[capabilityKey] ?? {}
    );

    return {
      ...envelope,
      [capabilityKey]: {
        ...capabilities,
        elicitation: {
          form: capabilities.elicitation?.form ?? {},
          url: capabilities.elicitation?.url ?? {},
        },
      },
    };
  }

  protected override async _resolveNonCompleteResult(
    ...[decoded, flow]: Parameters<Client["_resolveNonCompleteResult"]>
  ): Promise<unknown> {
    if (flow.request.method !== "tools/call") {
      // The envelope advertises elicitation on every modern request, but only
      // a tool call routes through an interrupt. On a modern connection no
      // `elicitation/create` handler is registered either, so the SDK driver
      // would fail with an opaque capability error: say which method asked.
      if (this.getProtocolEra() === "modern")
        throw new MCPClientError(
          `MCP server answered "${flow.request.method}" with a request for input, which this adapter can only answer for "tools/call".`
        );

      // A legacy connection registers a callback handler, so the SDK driver
      // can answer this itself.
      return super._resolveNonCompleteResult(decoded, flow);
    }

    throw new PendingMCPInput(
      decoded,
      CallToolRequestSchema.parse(flow.request).params
    );
  }
}

/** User-facing questions only. Server round state never leaves the execution. */
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
  // LangGraph builds interrupt IDs with XXH3 but does not export its own
  // validator from any entrypoint, so the shape is matched here rather than
  // deep-importing its internals.
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

/**
 * `tools/call` params plus the 2026 retry channel.
 *
 * The revision layers `inputResponses` and `requestState` onto the request
 * params for a retry; they are not part of `CallToolRequestParams` itself.
 */
type ElicitationRoundParams = CallToolRequest["params"] & {
  inputResponses?: MCPElicitationResponses;
  requestState?: string;
};

/** A round's outcome: the tool finished, or the server asked for input. */
type ElicitationRound =
  | { done: true; result: CallToolResult }
  | { done: false; pending: PendingMCPInput };

/** Everything the round loop needs to know about the call it is answering. */
export interface MCPElicitationSource {
  server: string;
  tool: string;
  maxRounds: number;
  /** No graph to interrupt, so questions are reported instead of asked. */
  direct?: boolean;
  signal?: AbortSignal;
}

/**
 * Questions asked so far against one call's allowance.
 *
 * Server rounds and re-asked answers spend the same budget, so neither a
 * server nor a caller resuming with invalid answers can hold a run open.
 */
interface ElicitationBudget {
  asks: number;
  readonly max: number;
}

/**
 * Issue one `tools/call`, turning the SDK's pending-input throw into a value.
 *
 * `_resolveNonCompleteResult` reports a request for input by throwing, so that
 * the response escapes `callTool`'s output-schema validation. Converting it
 * back to a value here lets the round loop test a condition rather than carry
 * a sentinel across passes.
 */
async function sendElicitationRound(
  execute: (params: ElicitationRoundParams) => Promise<CallToolResult>,
  request: ElicitationRoundParams,
  signal?: AbortSignal
): Promise<ElicitationRound> {
  signal?.throwIfAborted();

  try {
    return { done: true, result: await execute(request) };
  } catch (error) {
    if (!PendingMCPInput.isInstance(error)) throw error;

    // An aborted call reports the abort, not the response it happened to get.
    signal?.throwIfAborted();

    return { done: false, pending: error };
  }
}

/** Refuse what an interrupt cannot answer; otherwise render the question. */
async function elicitationQuestionFor(
  pending: PendingMCPInput,
  source: MCPElicitationSource,
  budget: ElicitationBudget
): Promise<{ question: MCPElicitationInterrupt; state?: string }> {
  const inputRequests = pending.pending.inputRequests ?? {};

  // Nothing can advance a response that carries no question, and the adapter
  // does not poll a server for completion.
  if (Object.keys(inputRequests).length === 0)
    throw new ToolException(
      `MCP tool "${source.tool}" on server "${source.server}" returned a state-only response, which is not supported.`,
      pending
    );

  if (source.direct)
    throw new ToolException(
      "This MCP tool requested user input. Invoke it inside a LangGraph with a checkpointer to pause and resume elicitation.",
      pending
    );

  // Never pause for an answer the budget can no longer spend: pausing and then
  // failing would cost a human round trip for nothing.
  if (budget.asks >= budget.max)
    throw new ToolException(
      `MCP tool "${source.tool}" on server "${source.server}" exceeded ${budget.max} elicitation rounds.`,
      pending
    );

  // Only elicitation can be answered from an interrupt. Sampling and roots
  // requests are refused by name rather than half-served, so the caller sees
  // which method it was instead of a schema parse failure. The Python adapter
  // refuses the same two.
  const unsupported = Object.entries(inputRequests)
    .filter(
      ([, request]) =>
        (request as { method?: string }).method !== "elicitation/create"
    )
    .map(
      ([key, request]) =>
        `${key} (${(request as { method?: string }).method ?? "unknown"})`
    );

  if (unsupported.length > 0)
    throw new ToolException(
      `MCP tool "${source.tool}" on server "${source.server}" requested input this adapter cannot answer: ${unsupported.join(", ")}. Only elicitation is answered through a graph interrupt.`,
      pending
    );

  return {
    // Parsing unwraps each `{ method, params }` envelope, so the answer schema
    // in `askUntilAnswered` is built from the schema the server requested.
    question: await elicitationInterruptSchema.parseAsync({
      type: "mcp_elicitation",
      server: source.server,
      tool: source.tool,
      requests: inputRequests,
    }),
    state: pending.pending.requestState,
  };
}

/**
 * Raise one question until it comes back with usable answers.
 *
 * A rejected answer is re-asked on the same thread with the reason attached
 * and costs no further round trip to the server: that question and its
 * `requestState` are still current. Every attempt spends the shared budget,
 * so the loop is bounded by it rather than running until something throws.
 */
async function askUntilAnswered(
  question: MCPElicitationInterrupt,
  source: MCPElicitationSource,
  budget: ElicitationBudget
): Promise<MCPElicitationResponses> {
  // The requested schemas do not change between re-asks, so bind them once.
  const answerSchema = z.strictObject({
    responses: z.strictObject(
      Object.fromEntries(
        Object.entries(question.requests).map(([key, requested]) => [
          key,
          elicitationAnswerFor(requested, modernElicitationAnswerSchema),
        ])
      )
    ),
  });

  let asked = question;

  while (budget.asks < budget.max) {
    source.signal?.throwIfAborted();
    budget.asks += 1;

    const answer = await answerSchema.safeParseAsync(interrupt(asked));
    if (answer.success) return answer.data.responses;

    asked = { ...asked, validationError: z.prettifyError(answer.error) };
  }

  // Re-asking spends a question too, and the same rule applies: fail now
  // rather than pausing for a correction that cannot be used.
  throw new ToolException(
    `MCP tool "${source.tool}" on server "${source.server}" exceeded ${budget.max} elicitation rounds while correcting an answer.`
  );
}

/**
 * Answer one tool call's elicitation rounds with graph interrupts.
 *
 * The adapter keeps no durable record of a round. When a graph resumes, the
 * tool node re-runs from the top: the initial `tools/call` is issued again, the
 * server answers with the same question, and `interrupt()` returns the supplied
 * answer instead of pausing. Only then is the answered follow-up sent, carrying
 * the `requestState` from the response this execution just replayed — never a
 * value saved from an earlier one.
 *
 * Work the server performed before asking therefore runs again on resume,
 * `beforeToolCall` runs once per execution, and the adapter promises no
 * exactly-once effects. Servers and hooks must be replay-safe; Mastra's
 * server-side implementation of this protocol leg documents the same
 * constraint.
 */
export async function callToolWithElicitation(
  execute: (params: ElicitationRoundParams) => Promise<CallToolResult>,
  params: CallToolRequest["params"],
  source: MCPElicitationSource
): Promise<CallToolResult> {
  const budget: ElicitationBudget = { asks: 0, max: source.maxRounds };

  let round = await sendElicitationRound(execute, params, source.signal);

  // The server is called only when there is something new to send it, so each
  // pass answers exactly one of its questions. An accepted answer is always
  // delivered before the budget can end the run, because delivery happens at
  // the bottom of the same pass that collected it.
  while (!round.done) {
    const { question, state } = await elicitationQuestionFor(
      round.pending,
      source,
      budget
    );

    const responses = await askUntilAnswered(question, source, budget);

    round = await sendElicitationRound(
      execute,
      { ...params, inputResponses: responses, requestState: state },
      source.signal
    );
  }

  return round.result;
}
