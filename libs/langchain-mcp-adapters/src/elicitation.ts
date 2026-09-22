import { z } from "zod";
import {
  Client,
  fromJsonSchema,
  isInputRequiredResult,
  type CallToolRequest,
  type CallToolResult,
  type ElicitRequest,
  type ElicitResult,
  type InputRequiredResult,
} from "@modelcontextprotocol/client";
import {
  ElicitRequestFormParamsSchema,
  ElicitRequestSchema,
  ElicitRequestURLParamsSchema,
  ElicitResultSchema,
} from "@modelcontextprotocol/core";
import { DefaultJsonSchemaValidator } from "@modelcontextprotocol/client/_shims";
import {
  interrupt,
  isGraphInterrupt,
  type Interrupt,
} from "@langchain/langgraph";
import { ToolException } from "./utils/errors.js";

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

/** The interrupt payload raised while an MCP tool call waits on input. */
const elicitationInterruptSchema = z.object({
  type: z.literal("mcp_elicitation"),
  server: z.string(),
  tool: z.string(),
  requests: z.record(z.string(), modernElicitationRequestSchema),
});

export type MCPElicitationInterrupt = z.output<
  typeof elicitationInterruptSchema
>;

/** Answers to one question set, keyed by the server's input-request keys. */
export type MCPElicitationResponses = Record<
  string,
  z.output<typeof modernElicitationAnswerSchema>
>;

/** Resume values target the graph task that raised the question. */
export type MCPElicitationResume = Record<
  string,
  { responses: MCPElicitationResponses }
>;

const elicitationTargetSchema = z.object({
  // LangGraph derives this from the node's checkpoint namespace.
  id: z.string().regex(/^[0-9a-f]{32}$/, "Expected a LangGraph interrupt ID"),
  value: elicitationInterruptSchema.pick({ type: true }),
});

/** Build an answer addressed to the task that raised `pending`. */
export function createMCPElicitationResume(
  pending: Interrupt<unknown>,
  responses: MCPElicitationResponses
): MCPElicitationResume {
  const { id } = elicitationTargetSchema.parse(pending);
  return { [id]: { responses } };
}

/** `tools/call` params plus the 2026-07-28 retry channel. */
export type ElicitationRoundParams = CallToolRequest["params"] & {
  inputResponses?: MCPElicitationResponses;
  requestState?: string;
};

/**
 * Issue one `tools/call` that may answer with `input_required`.
 *
 * Callers opt in per call with the SDK's `allowInputRequired` request option,
 * which is what widens the result beyond {@link CallToolResult}.
 */
export type ElicitationRound = (
  params: ElicitationRoundParams
) => Promise<CallToolResult | InputRequiredResult>;

export interface MCPElicitationSource {
  /** Configured server name, for error messages. */
  server: string;
  /** Tool name as this adapter published it. */
  tool: string;
  /** No graph to interrupt, so a question is refused rather than asked. */
  direct?: boolean;
  signal?: AbortSignal;
}

function noWayToAnswer(cause?: unknown): ToolException {
  return new ToolException(
    "This MCP tool requested user input. Invoke it inside a LangGraph with a checkpointer to pause and resume elicitation.",
    cause
  );
}

/**
 * Raise one question, translating LangGraph's own refusals.
 *
 * `interrupt()` rejects a call made outside a graph, and a graph compiled
 * without a checkpointer, before it ever suspends. Both mean the same thing
 * here, so the refusal is read off the pause rather than probed for with a
 * private config key.
 */
function ask(question: MCPElicitationInterrupt): unknown {
  try {
    return interrupt<MCPElicitationInterrupt, unknown>(question);
  } catch (error) {
    if (isGraphInterrupt(error)) throw error;
    throw noWayToAnswer(error);
  }
}

/**
 * Narrow a round's requests to elicitations a human can answer.
 *
 * Sampling and roots are refused by name rather than half-served, and a round
 * carrying only a `requestState` is refused too: nothing can advance a response
 * with no question in it, and the adapter does not poll a server for
 * completion. The Python adapter refuses the same three.
 */
function elicitationRequestsOf(
  result: InputRequiredResult,
  source: MCPElicitationSource
): Record<string, ElicitRequest["params"]> {
  const requests = Object.entries(result.inputRequests ?? {});

  if (requests.length === 0)
    throw new ToolException(
      `MCP tool "${source.tool}" on server "${source.server}" returned a state-only response, which is not supported.`
    );

  const unsupported = requests
    .filter(([, request]) => request.method !== "elicitation/create")
    .map(([key, request]) => `${key} (${request.method})`);

  if (unsupported.length > 0)
    throw new ToolException(
      `MCP tool "${source.tool}" on server "${source.server}" requested input this adapter cannot answer: ${unsupported.join(", ")}. Only elicitation is answered through a graph interrupt.`
    );

  return Object.fromEntries(
    requests.map(([key, request]) => [key, (request as ElicitRequest).params])
  );
}

/**
 * Turn a resumed answer into the server's responses.
 *
 * A malformed or missing answer fails the call rather than re-asking: the
 * caller resuming the graph is code, not the human who filled the form, so a
 * second identical question would not fix a wrong shape.
 */
async function buildResponses(
  requests: Record<string, ElicitRequest["params"]>,
  resumed: unknown,
  source: MCPElicitationSource
): Promise<MCPElicitationResponses> {
  const answers = z
    .object({ responses: z.record(z.string(), z.unknown()) })
    .safeParse(resumed);

  if (!answers.success)
    throw new ToolException(
      `Resuming MCP tool "${source.tool}" needs { responses } keyed by request. Build it with createMCPElicitationResume().`
    );

  const missing = Object.keys(requests).filter(
    (key) => !(key in answers.data.responses)
  );

  if (missing.length > 0)
    throw new ToolException(
      `Resuming MCP tool "${source.tool}" needs an answer for every elicitation request, but these had none: ${missing.join(", ")}.`
    );

  // An answer the server never asked for means the resume was built for a
  // different question, so it is refused rather than quietly dropped.
  const unexpected = Object.keys(answers.data.responses).filter(
    (key) => !(key in requests)
  );

  if (unexpected.length > 0)
    throw new ToolException(
      `Resuming MCP tool "${source.tool}" answered requests the server did not make: ${unexpected.join(", ")}.`
    );

  const entries = await Promise.all(
    Object.entries(requests).map(async ([key, request]) => {
      const parsed = await elicitationAnswerFor(
        request,
        modernElicitationAnswerSchema
      ).safeParseAsync(answers.data.responses[key]);

      if (!parsed.success)
        throw new ToolException(
          `Elicitation answer for "${key}" on MCP tool "${source.tool}" is invalid: ${z.prettifyError(parsed.error)}`
        );

      return [key, parsed.data] as const;
    })
  );

  return Object.fromEntries(entries);
}

/**
 * Call an MCP tool, answering each round of requested input with an interrupt.
 *
 * `interrupt()` unwinds the whole call, so on resume the tool is re-issued from
 * the first round and the server hands back a fresh `requestState`. A server
 * that asks before doing work repeats nothing; one that works first repeats
 * that work once per round, so effects must be idempotent.
 */
export async function callToolWithElicitation(
  round: ElicitationRound,
  params: CallToolRequest["params"],
  source: MCPElicitationSource
): Promise<CallToolResult> {
  source.signal?.throwIfAborted();
  let result = await round(params);

  while (isInputRequiredResult(result)) {
    const requests = elicitationRequestsOf(result, source);
    if (source.direct) throw noWayToAnswer();

    const responses = await buildResponses(
      requests,
      ask({
        type: "mcp_elicitation",
        server: source.server,
        tool: source.tool,
        requests,
      }),
      source
    );

    source.signal?.throwIfAborted();
    result = await round({
      ...params,
      inputResponses: responses,
      requestState: result.requestState,
    });
  }

  return result;
}
