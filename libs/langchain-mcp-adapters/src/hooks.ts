import { z } from "zod";
import { isCommand, type Command } from "@langchain/langgraph";
import {
  isSpecType,
  type EmbeddedResource,
} from "@modelcontextprotocol/client";
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

const toolCallRequestSchema = z.object({
  serverName: z.string(),
  name: z.string(),
  args: z.unknown(),
});
export type ToolCallRequest = z.output<typeof toolCallRequestSchema>;

// Core content blocks are extensible records, not a closed list of provider
// formats. Preserve extension fields without claiming their format is validated.
const contentBlockSchema = z.looseObject({
  type: z.string(),
  id: z.string().optional(),
}) satisfies z.ZodType<ContentBlock>;

const toolContentSchema = z.union([z.string(), z.array(contentBlockSchema)]);

// MCP owns embedded resource semantics. Other artifacts include both legacy
// data blocks and current LangChain blocks, so validate their shared boundary.
const toolArtifactSchema = z.union([
  z.custom<EmbeddedResource>(isSpecType.EmbeddedResource),
  contentBlockSchema.refine((block) => block.type !== "resource", {
    error: "Expected a valid MCP embedded resource",
  }),
]);
const toolResultBeforeSchema = z.tuple([
  toolContentSchema,
  z.array(toolArtifactSchema),
]);
type ToolResultBefore = z.output<typeof toolResultBeforeSchema>;

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
export type ToolResult = z.output<typeof toolResultSchema>;

const toolCallResultSchema = toolCallRequestSchema.extend({
  result: toolResultSchema,
});
export type ModifiedToolCallResult = z.output<typeof toolCallResultSchema>;

export const toolCallResultModificationSchema = z.object({
  result: toolResultSchema,
});

export const toolCallModificationSchema = z
  .object({
    headers: z.record(z.string(), z.string()),
    args: z.record(z.string(), z.unknown()),
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
    .custom<
      (
        request: ToolCallRequest,
        state: State,
        config: RunnableConfig
      ) => ToolCallModification | void | Promise<ToolCallModification | void>
    >(
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
    .custom<
      (
        request: ToolCallRequest & { result: ToolResultBefore },
        state: State,
        config: RunnableConfig
      ) =>
        | z.output<typeof toolCallResultModificationSchema>
        | void
        | Promise<z.output<typeof toolCallResultModificationSchema> | void>
    >(
      (value) => typeof value === "function",
      "Expected an afterToolCall callback"
    )
    .optional(),
});

/** Hooks preserve native inputs; awaited modifications are parsed at invocation. */
export type ToolHooks = z.input<typeof toolHooksSchema>;
