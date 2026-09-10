import { z } from "zod/v4";
import { isCommand, type Command } from "@langchain/langgraph";
import type { EmbeddedResource } from "@modelcontextprotocol/client";
import type { ContentBlock } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { ToolMessage } from "@langchain/core/messages";

/**
 * state messages
 *
 * Note: this may not be defined in cases you don't use LangGraph or a LangGraph implementation like `createAgent`.
 * Also state can be defined arbitrarily by the user.
 */
export type State = Record<string, unknown>;

export interface ToolCallRequest {
  serverName: string;
  name: string;
  args: unknown;
}

type ToolContent =
  | string
  | (ContentBlock | ContentBlock.Data.DataContentBlock)[];
type ToolArtifacts = (EmbeddedResource | ContentBlock.Multimodal.Standard)[];
type ToolResultBefore = [ToolContent, ToolArtifacts];

// Validate the hook's result container; native content and artifact semantics
// belong to the result adapter rather than a duplicate core/MCP schema here.
const toolResultBeforeSchema = z.tuple([
  z.custom<ToolContent>(
    (value) => typeof value === "string" || Array.isArray(value)
  ),
  z.custom<ToolArtifacts>(Array.isArray),
]);

/**
 * Tool result schema that users can return within the `afterToolCall` callback
 */
const toolResultSchema = z.union([
  /**
   * a basic string result
   */
  z.string(),
  /**
   * Command from LangGraph
   */
  z.custom<Command>(isCommand),
  /**
   * 2-tuple of content, artifact
   */
  toolResultBeforeSchema,
  /**
   * ToolMessage return
   */
  z.custom<ToolMessage>(ToolMessage.isInstance),
]);
export type ToolResult = string | Command | ToolResultBefore | ToolMessage;

export type ModifiedToolCallResult = ToolCallRequest & { result: ToolResult };

export const toolCallResultModificationSchema = z.object({
  result: toolResultSchema,
});

export const toolCallModificationSchema = z
  .object({
    headers: z.record(z.string(), z.string()),
    args: z.unknown(),
  })
  .partial();
export type ToolCallModification = z.output<typeof toolCallModificationSchema>;

export const toolHooksSchema = z.object({
  /**
   * Called before a tool call is made.
   * Allows you to modify the tool call arguments or return a different tool call.
   *
   * @param toolCallRequest - The tool call request
   * @param toolCallRequest.name - The tool name
   * @param toolCallRequest.args - The tool call arguments
   * @param toolCallRequest.serverName - The server name
   * @param config - The runnable config
   * @returns The tool call modification
   *
   * @example
   * ```ts
   * const interceptor = {
   *   beforeToolCall: (toolCallRequest, state, runtime) => {
   *     return {
   *       args: {
   *         ...toolCallRequest.args,
   *         custom: "Custom Value"
   *       },
   *       headers: { "X-Custom-Header": "Custom Value" }
   *     };
   *   },
   * };
   * ```
   */
  beforeToolCall: z
    .custom<NonNullable<ToolHooks["beforeToolCall"]>>(
      (value) => typeof value === "function",
      "Expected a beforeToolCall callback"
    )
    .optional(),

  /**
   * Called after a tool call is made.
   * Allows you to modify the tool call result or return a different tool call result.
   *
   * @param toolCallResult - The tool call result
   * @param toolCallResult.args - The tool call arguments
   * @param toolCallResult.serverName - The server name
   * @param toolCallResult.name - The tool name
   * @param toolCallResult.result - The tool call result
   * @param config - The runnable config
   * @returns The tool call modification
   * @example
   * ```ts
   * const interceptor = {
   *   afterToolCall: (toolCallResult, state, runtime) => {
   *     if (toolCallResult.name === "calculator") {
   *       return { result: ["Custom Value", []] };
   *     }
   *     return { result: toolCallResult.result };
   *   },
   * };
   * ```
   */
  afterToolCall: z
    .custom<NonNullable<ToolHooks["afterToolCall"]>>(
      (value) => typeof value === "function",
      "Expected an afterToolCall callback"
    )
    .optional(),
});

/** Hooks receive native values. Their returned modifications are parsed after awaiting them. */
export interface ToolHooks {
  beforeToolCall?: (
    request: ToolCallRequest,
    state: State,
    config: RunnableConfig
  ) => ToolCallModification | void | Promise<ToolCallModification | void>;
  afterToolCall?: (
    request: ToolCallRequest & { result: ToolResultBefore },
    state: State,
    config: RunnableConfig
  ) =>
    | Pick<ModifiedToolCallResult, "result">
    | void
    | Promise<Pick<ModifiedToolCallResult, "result"> | void>;
}
