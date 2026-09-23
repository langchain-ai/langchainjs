import { ns, LangChainError } from "@langchain/core/errors";
import type { CallToolResult } from "@modelcontextprotocol/client";
import { UnauthorizedError } from "@modelcontextprotocol/client";
import { z } from "zod";

/** An operational failure while connecting to or using an MCP server. */
export class MCPClientError extends ns
  .sub("mcp")
  .brand(LangChainError, "client") {
  readonly name = "MCPClientError";

  constructor(
    message: string,
    public readonly serverName?: string,
    options?: ErrorOptions
  ) {
    super(message);

    if (options && "cause" in options) this.cause = options.cause;
  }
}

/**
 * Custom error class for tool exceptions
 */
export class ToolException extends ns.sub("mcp").brand(LangChainError, "tool") {
  readonly name = "ToolException";
  readonly result?: CallToolResult;

  constructor(message: string, cause?: unknown, result?: CallToolResult) {
    super(message);
    this.result = result;

    if (cause !== undefined) this.cause = cause;
  }
}

export function isToolException(error: unknown): error is ToolException {
  return ToolException.isInstance(error);
}

const httpStatusSchema = z.int().min(100).max(599);

const httpErrorFieldsSchema = z.object({
  status: httpStatusSchema.optional().catch(undefined),
  code: httpStatusSchema.optional().catch(undefined),
  message: z.string().optional().catch(undefined),
});

export function getHttpErrorCode(error: unknown): number | undefined {
  const parsed = httpErrorFieldsSchema.safeParse(error);

  if (!parsed.success) return undefined;

  // SDK 2 HTTP errors use status; SSE errors use a numeric code.
  const { status, code, message } = parsed.data;
  const match = message?.match(/\(HTTP (\d{3})\)/);

  return status ?? code ?? httpStatusSchema.safeParse(Number(match?.[1])).data;
}

/**
 * Whether `error`, or its direct cause, means the server wants credentials:
 * the SDK's `UnauthorizedError` (provider flows, which carry no HTTP status)
 * or an HTTP 401.
 */
export function isAuthenticationError(error: unknown): boolean {
  const matches = (value: unknown) =>
    UnauthorizedError.isInstance(value) || getHttpErrorCode(value) === 401;

  return matches(error) || (error instanceof Error && matches(error.cause));
}

export function createAuthenticationErrorMessage(
  serverName: string,
  url: string,
  transport: "HTTP" | "SSE",
  originalError: string
): string {
  return (
    `Authentication failed for ${transport} server "${serverName}" at ${url}. ` +
    `Please check your credentials, authorization headers, or OAuth configuration. ` +
    `Original error: ${originalError}`
  );
}
