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
import { compare } from "@langchain/core/utils/json_patch";
import { v4 as uuid } from "@langchain/core/utils/uuid";
import {
  getConfig,
  interrupt,
  task,
  type Interrupt,
} from "@langchain/langgraph";
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

/** Public questions omit the checkpointed server continuation. */
const elicitationInterruptSchema = z.object({
  type: z.literal("mcp_elicitation"),
  server: z.string(),
  tool: z.string(),
  questionId: z.string(),
  attempt: z.number().int().positive(),
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

/** Resume values target both the graph task and the displayed question attempt. */
export type MCPElicitationResume = Record<
  string,
  { questionId: string; attempt: number; responses: MCPElicitationResponses }
>;

const elicitationTargetSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{32}$/, "Expected a LangGraph interrupt ID"),
  value: elicitationInterruptSchema.pick({
    type: true,
    questionId: true,
    attempt: true,
  }),
});

/** Build an answer bound to the observed task and question attempt. */
export function createMCPElicitationResume(
  pending: Interrupt<unknown>,
  responses: MCPElicitationResponses
): MCPElicitationResume {
  const { id, value } = elicitationTargetSchema.parse(pending);
  return {
    [id]: { questionId: value.questionId, attempt: value.attempt, responses },
  };
}

type ElicitationRoundParams = CallToolRequest["params"] & {
  inputResponses?: MCPElicitationResponses;
  requestState?: string;
};

type UncachedInvocation = {
  uncached: true;
  server: string;
  request: ElicitationRoundParams;
  hasHeaderOverrides: true;
};

type ElicitationRound = {
  server: string;
  request: ElicitationRoundParams;
  maxRounds: number;
  hasHeaderOverrides: boolean;
} & (
  | { done: true; result: CallToolResult }
  | {
      done: false;
      questionId: string;
      pending: Pick<PendingInput, "inputRequests" | "requestState">;
    }
);

export interface MCPElicitationSource {
  server: string;
  tool: string;
  maxRounds: number;
  direct?: boolean;
  hasHeaderOverrides?: boolean;
  signal?: AbortSignal;
}

/** Complete one wire exchange as serializable data before any human pause. */
async function sendElicitationRound(
  execute: (params: ElicitationRoundParams) => Promise<CallToolResult>,
  request: ElicitationRoundParams,
  source: MCPElicitationSource
): Promise<ElicitationRound> {
  source.signal?.throwIfAborted();
  const operation = {
    server: source.server,
    request,
    maxRounds: source.maxRounds,
    hasHeaderOverrides: source.hasHeaderOverrides === true,
  };

  try {
    const result = await execute(request);
    source.signal?.throwIfAborted();
    return { ...operation, done: true, result };
  } catch (error) {
    if (!PendingMCPInput.isInstance(error)) throw error;
    source.signal?.throwIfAborted();
    return {
      ...operation,
      done: false,
      questionId: uuid(),
      pending: {
        inputRequests: error.pending.inputRequests,
        requestState: error.pending.requestState,
      },
    };
  }
}

/** Validate answerable input without exposing the server continuation. */
async function elicitationQuestionFor(
  round: Extract<ElicitationRound, { done: false }>,
  source: MCPElicitationSource,
  asks: number,
  maxRounds: number,
  durable: boolean
): Promise<MCPElicitationInterrupt> {
  const inputRequests = round.pending.inputRequests ?? {};

  if (Object.keys(inputRequests).length === 0)
    throw new ToolException(
      `MCP tool "${source.tool}" on server "${source.server}" returned a state-only response, which is not supported.`
    );

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
      `MCP tool "${source.tool}" on server "${source.server}" requested input this adapter cannot answer: ${unsupported.join(", ")}. Only elicitation is answered through a graph interrupt.`
    );

  if (!durable)
    throw new ToolException(
      "This MCP tool requested user input. Invoke it inside a LangGraph with a checkpointer to pause and resume elicitation."
    );

  if (source.hasHeaderOverrides || round.hasHeaderOverrides)
    throw new ToolException(
      "Durable MCP elicitation does not support beforeToolCall header overrides. Configure a stable server authentication identity instead."
    );

  if (asks >= maxRounds)
    throw new ToolException(
      `MCP tool "${source.tool}" on server "${source.server}" exceeded ${maxRounds} elicitation rounds.`
    );

  return elicitationInterruptSchema.parseAsync({
    type: "mcp_elicitation",
    server: source.server,
    tool: source.tool,
    questionId: round.questionId,
    attempt: asks + 1,
    requests: inputRequests,
  });
}

/** Reconstruct question-attempt spending from saved answers, without network IO. */
async function askUntilAnswered(
  question: MCPElicitationInterrupt,
  source: MCPElicitationSource,
  maxRounds: number
): Promise<{ responses: MCPElicitationResponses; asks: number }> {
  const responsesSchema = z.strictObject(
    Object.fromEntries(
      Object.entries(question.requests).map(([key, requested]) => [
        key,
        elicitationAnswerFor(requested, modernElicitationAnswerSchema),
      ])
    )
  );
  let asked = question;

  while (asked.attempt <= maxRounds) {
    source.signal?.throwIfAborted();
    const envelope = z
      .strictObject({
        questionId: z.literal(asked.questionId),
        attempt: z.literal(asked.attempt),
        responses: z.unknown(),
      })
      .safeParse(interrupt(asked));

    if (!envelope.success)
      throw new ToolException(
        "MCP elicitation answer does not match the pending question attempt. Use createMCPElicitationResume with the latest interrupt."
      );

    const answer = await responsesSchema.safeParseAsync(
      envelope.data.responses
    );
    if (answer.success) return { responses: answer.data, asks: asked.attempt };

    asked = {
      ...asked,
      attempt: asked.attempt + 1,
      validationError: z.prettifyError(answer.error),
    };
  }

  throw new ToolException(
    `MCP tool "${source.tool}" on server "${source.server}" exceeded ${maxRounds} elicitation rounds while correcting an answer.`
  );
}

/** Resume completed rounds from checkpoints; remote effects still require idempotency. */
export async function callToolWithElicitation(
  execute: (params: ElicitationRoundParams) => Promise<CallToolResult>,
  params: CallToolRequest["params"],
  source: MCPElicitationSource
): Promise<CallToolResult> {
  const checkpointer = getConfig()?.configurable?.__pregel_checkpointer;
  const durable =
    !source.direct &&
    checkpointer != null &&
    typeof checkpointer.putWrites === "function";
  const nextRound = async (request: ElicitationRoundParams) => {
    source.signal?.throwIfAborted();
    const sendRound = (): Promise<ElicitationRound> =>
      sendElicitationRound(execute, request, source);
    const recordRound = (): Promise<ElicitationRound | UncachedInvocation> =>
      source.hasHeaderOverrides
        ? Promise.resolve({
            uncached: true,
            server: source.server,
            request,
            hasHeaderOverrides: true,
          })
        : sendRound();
    const round = durable
      ? await task(
          { name: "mcp.tool.round", retry: { maxAttempts: 1 } },
          recordRound
        )()
      : await sendRound();
    source.signal?.throwIfAborted();
    if (
      round.server !== source.server ||
      compare(round.request, request).length ||
      round.hasHeaderOverrides !== (source.hasHeaderOverrides === true)
    )
      throw new ToolException(
        "MCP tool operation changed while paused. Start a new operation instead of reusing its elicitation answers."
      );
    return "uncached" in round ? sendRound() : round;
  };

  let round = await nextRound(params);
  const maxRounds = round.maxRounds;
  let asks = 0;

  while (!round.done) {
    const question = await elicitationQuestionFor(
      round,
      source,
      asks,
      maxRounds,
      durable
    );
    const answer = await askUntilAnswered(question, source, maxRounds);
    asks = answer.asks;
    round = await nextRound({
      ...params,
      inputResponses: answer.responses,
      requestState: round.pending.requestState,
    });
  }

  return round.result;
}
