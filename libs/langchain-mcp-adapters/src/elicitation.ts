import {
  fromJsonSchema,
  specTypeSchemas,
  type Client,
  type ElicitRequest,
  type ElicitResult,
} from "@modelcontextprotocol/client";
import { DefaultJsonSchemaValidator } from "@modelcontextprotocol/client/_shims";

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
export async function validateElicitationAnswer(
  request: MCPElicitationRequest,
  input: unknown
): Promise<MCPElicitationAnswer> {
  const parsed = specTypeSchemas.ElicitResult["~standard"].validate(input);

  if (parsed.issues) {
    throw new Error(
      "Invalid MCP elicitation answer: expected accept, decline, or cancel"
    );
  }

  const answer = parsed.value;

  if (request.mode === "url") {
    if (answer.content !== undefined) {
      throw new Error("URL elicitation answers cannot contain form content");
    }
  } else if (answer.action === "accept") {
    const validator = fromJsonSchema(
      request.requestedSchema,
      new DefaultJsonSchemaValidator()
    );

    const result = await validator["~standard"].validate(answer.content ?? {});

    if (result.issues) {
      throw new Error(
        "MCP elicitation answer does not match the requested form schema"
      );
    }
  }

  return answer;
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
