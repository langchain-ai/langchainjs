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
import { compare } from "@langchain/core/utils/json_patch";
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

/** A modern question: the shape an `elicitation/create` request carries. */
const modernQuestionSchema = z.union([
  modernFormRequestSchema,
  modernURLRequestSchema,
]);

export const modernElicitationRequestSchema = ElicitRequestSchema.extend({
  params: modernQuestionSchema,
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

/**
 * The interrupt payload raised while an MCP tool call waits on input.
 *
 * It carries the effective arguments as well as the questions, because both
 * are what the human is consenting to.
 */
const elicitationInterruptSchema = z.object({
  type: z.literal("mcp_elicitation"),
  server: z.string(),
  tool: z.string(),
  arguments: z.record(z.string(), z.unknown()).optional(),
  // The payload carries each request's params, which is what
  // `modernElicitationRequestSchema` transforms a wire request *into* — so the
  // payload is described by that output shape, not by the wire schema again.
  requests: z.record(z.string(), modernQuestionSchema),
});

export type MCPElicitationInterrupt = z.output<
  typeof elicitationInterruptSchema
>;

/** Answers to one question set, keyed by the server's input-request keys. */
export type MCPElicitationResponses = Record<
  string,
  z.output<typeof modernElicitationAnswerSchema>
>;

/** Resume values carry the question they answer, keyed by graph task. */
export type MCPElicitationResume = Record<
  string,
  { question: MCPElicitationInterrupt; responses: MCPElicitationResponses }
>;

const elicitationTargetSchema = z.object({
  // LangGraph derives this from the node's checkpoint namespace.
  id: z.string().regex(/^[0-9a-f]{32}$/, "Expected a LangGraph interrupt ID"),
  value: elicitationInterruptSchema,
});

/**
 * Build an answer addressed to the task and question that raised `pending`.
 *
 * The question travels with the answer because resuming replays the tool call:
 * the server is asked again and may answer differently, so the driver compares
 * what the human saw against what it now has.
 */
export function createMCPElicitationResume(
  pending: Interrupt<unknown>,
  responses: MCPElicitationResponses
): MCPElicitationResume {
  const { id, value } = elicitationTargetSchema.parse(pending);
  return { [id]: { question: value, responses } };
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
  server: string,
  tool: string
): Record<string, ModernElicitationRequest> {
  const requests = Object.entries(result.inputRequests ?? {});

  if (requests.length === 0)
    throw new ToolException(
      `MCP tool "${tool}" on server "${server}" returned a state-only response, which is not supported.`
    );

  const unsupported = requests
    .filter(([, request]) => request.method !== "elicitation/create")
    .map(([key, request]) => `${key} (${request.method})`);

  if (unsupported.length > 0)
    throw new ToolException(
      `MCP tool "${tool}" on server "${server}" requested input this adapter cannot answer: ${unsupported.join(", ")}. Only elicitation is answered through a graph interrupt.`
    );

  return Object.fromEntries(
    requests.map(([key, request]) => [
      key,
      modernElicitationRequestSchema.parse(request),
    ])
  );
}

/**
 * Raise one question and parse the answer that comes back.
 *
 * `interrupt()` rejects a call made outside a graph, and a graph compiled
 * without a checkpointer, before it ever suspends — both mean the same thing
 * here, so the refusal is read off the pause rather than probed for.
 *
 * The answer is parsed as a whole against the question it claims to answer:
 * the saved question must still match the one now pending, the keys must be
 * exactly the server's, and each answer must satisfy the schema that question
 * requested. A malformed answer fails the call rather than re-asking, since
 * the caller resuming the graph is code, not the human who filled the form.
 */
async function answerFor(
  question: MCPElicitationInterrupt
): Promise<MCPElicitationResponses> {
  let resumed: unknown;

  try {
    resumed = interrupt<MCPElicitationInterrupt, unknown>(question);
  } catch (error) {
    if (isGraphInterrupt(error)) throw error;
    throw new ToolException(
      "This MCP tool requested user input. Invoke it inside a LangGraph with a checkpointer to pause and resume elicitation.",
      error
    );
  }

  const answered = await z
    .object({
      // Replaying the call can surface a different question under the same
      // keys and schema — "approve $1,000" where the human approved "approve
      // $10" — or different effective arguments. Consent covers what was
      // shown, so the answer is refused rather than applied to it.
      question: z
        .looseObject({})
        .refine((saved) => compare(saved, question).length === 0, {
          error:
            "answers a question that is no longer the one this tool call is asking",
        }),
      responses: z.strictObject(
        Object.fromEntries(
          Object.entries(question.requests).map(([key, request]) => [
            key,
            elicitationAnswerFor(request, modernElicitationAnswerSchema),
          ])
        )
      ),
    })
    .safeParseAsync(resumed);

  if (!answered.success)
    throw new ToolException(
      `Resuming MCP tool "${question.tool}" on server "${question.server}" needs answers built by createMCPElicitationResume() from the latest interrupt: ${z.prettifyError(answered.error)}`
    );

  return answered.data.responses;
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
  server: string,
  tool: string,
  signal?: AbortSignal
): Promise<CallToolResult> {
  signal?.throwIfAborted();
  let result = await round(params);

  while (isInputRequiredResult(result)) {
    const responses = await answerFor({
      type: "mcp_elicitation",
      server,
      tool,
      arguments: params.arguments,
      requests: elicitationRequestsOf(result, server, tool),
    });

    signal?.throwIfAborted();
    result = await round({
      ...params,
      inputResponses: responses,
      requestState: result.requestState,
    });
  }

  return result;
}
