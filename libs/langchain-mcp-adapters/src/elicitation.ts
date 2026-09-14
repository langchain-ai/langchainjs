import {
  fromJsonSchema,
  type Client,
  type ElicitRequest,
  type ElicitResult,
} from "@modelcontextprotocol/client";
import { ElicitResultSchema } from "@modelcontextprotocol/core";
import { DefaultJsonSchemaValidator } from "@modelcontextprotocol/client/_shims";

export const elicitationAnswerSchema = ElicitResultSchema;

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
export function elicitationAnswerFor(request: MCPElicitationRequest) {
  return elicitationAnswerSchema.check(async (ctx) => {
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
