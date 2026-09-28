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

/** `.cause` hops {@link isAuthenticationError} follows before giving up. */
const MAX_CAUSE_WALK_DEPTH = 3;

/**
 * Whether `error`, or a cause up to {@link MAX_CAUSE_WALK_DEPTH} hops down
 * its `.cause` chain, means the server wants credentials: the SDK's
 * `UnauthorizedError` (provider flows, no HTTP status) or an HTTP 401. Two
 * hops handles the legacy HTTP→SSE fallback, which wraps its own
 * `MCPClientError` around the SSE 401.
 */
export function isAuthenticationError(error: unknown): boolean {
  const matches = (value: unknown) =>
    UnauthorizedError.isInstance(value) || getHttpErrorCode(value) === 401;

  let current: unknown = error;
  for (let depth = 0; depth <= MAX_CAUSE_WALK_DEPTH; depth += 1) {
    if (matches(current)) return true;
    if (!(current instanceof Error)) return false;
    current = current.cause;
  }

  return false;
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
