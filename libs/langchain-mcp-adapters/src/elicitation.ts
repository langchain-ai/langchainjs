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
  schema: z.ZodType<ElicitResult> = ElicitResultSchema
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

/** Resume values, keyed by the graph task whose interrupt they answer. */
export type MCPElicitationResume = Record<
  string,
  { responses: MCPElicitationResponses }
>;

/** `Interrupt` types `id` as optional and `value` as `any`, so parse both. */
const elicitationTargetSchema = z.object({
  id: z.string().min(1),
  value: elicitationInterruptSchema,
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
 * Questions a graph interrupt can carry.
 *
 * Sampling and roots fail the `elicitation/create` literal, naming the key
 * that asked. A round with no questions is refused too: nothing can advance a
 * response that asks nothing, and the adapter does not poll for completion.
 * The Python adapter refuses the same three.
 */
const answerableRequestsSchema = z
  .record(z.string(), modernElicitationRequestSchema)
  .refine((requests) => Object.keys(requests).length > 0, {
    error: "a state-only response carries no question to ask",
  });

/**
 * Raise one question and parse the answer that comes back.
 *
 * `interrupt()` rejects a call made outside a graph, and a graph compiled
 * without a checkpointer, before it ever suspends — both mean the same thing
 * here, so the refusal is read off the pause rather than probed for.
 *
 * The answer is parsed against the question now being asked: exactly the
 * server's keys, each answer against that question's requested schema. The
 * question the human saw is not compared with it, as in the Python adapter,
 * so a replay that asks something different under the same keys receives the
 * earlier answer. A malformed answer fails the call rather than re-asking,
 * since the caller resuming the graph is code, not the human who filled the
 * form.
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
  round: (
    params: ElicitationRoundParams
  ) => Promise<CallToolResult | InputRequiredResult>,
  params: CallToolRequest["params"],
  server: string,
  tool: string,
  signal?: AbortSignal
): Promise<CallToolResult> {
  signal?.throwIfAborted();
  let result = await round(params);

  while (isInputRequiredResult(result)) {
    const requests = answerableRequestsSchema.safeParse(
      result.inputRequests ?? {}
    );

    if (!requests.success)
      throw new ToolException(
        `MCP tool "${tool}" on server "${server}" asked for input this adapter cannot answer: ${z.prettifyError(requests.error)}`
      );

    const responses = await answerFor({
      type: "mcp_elicitation",
      server,
      tool,
      arguments: params.arguments,
      requests: requests.data,
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
