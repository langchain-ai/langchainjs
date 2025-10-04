import { z } from "zod/v3";
import type { Command } from "@langchain/langgraph";
import type { EmbeddedResource } from "@modelcontextprotocol/sdk/types.js";
import type { ContentBlock } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { ToolMessage } from "@langchain/core/messages";

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

const toolResultBeforeSchema = z.tuple([
  z.custom<string | (ContentBlock | ContentBlock.Data.DataContentBlock)[]>(),
  z.array(
    z.union([
      z.custom<EmbeddedResource>(),
      z.custom<ContentBlock.Multimodal.Standard>(),
    ])
  ),
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
  z.custom<Command>(),
  /**
   * 2-tuple of content, artifact
   */
  toolResultBeforeSchema,
  /**
   * ToolMessage return
   */
  z.custom<ToolMessage>(),
]);
export type ToolResult = z.output<typeof toolResultSchema>;

const toolCallResultSchema = z.object({
  ...toolCallRequestSchema.shape,
  result: toolResultBeforeSchema,
});

const modifiedToolCallResultSchema = z.object({
  ...toolCallRequestSchema.shape,
  result: toolResultSchema,
});
export type ModifiedToolCallResult = z.output<
  typeof modifiedToolCallResultSchema
>;

const toolCallModificationSchema = z
  .object({
    headers: z.record(z.string()),
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
   *       header: { "X-Custom-Header": "Custom Value" }
   *     };
   *   },
   * };
   * ```
   */
  beforeToolCall: z
    .function()
    .args(toolCallRequestSchema, z.custom<State>(), z.custom<RunnableConfig>())
    .returns(
      z.union([
        z.promise(toolCallModificationSchema),
        toolCallModificationSchema,
        z.void(),
        z.promise(z.void()),
      ])
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
   *       return ["Custom Value", []];
   *     }
   *     return toolCallResult.result;
   *   },
   * };
   * ```
   */
  afterToolCall: z
    .function()
    .args(toolCallResultSchema, z.custom<State>(), z.custom<RunnableConfig>())
    .returns(
      z.union([
        z.promise(modifiedToolCallResultSchema.pick({ result: true })),
        modifiedToolCallResultSchema.pick({ result: true }),
        z.void(),
        z.promise(z.void()),
      ])
    )
    .optional(),
});
export type ToolHooks = z.input<typeof toolHooksSchema>;
