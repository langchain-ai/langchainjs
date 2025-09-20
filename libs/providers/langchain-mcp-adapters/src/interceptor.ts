import { z } from "zod/v3";
import {
  LoggingMessageNotificationSchema,
  ProgressSchema,
  EmbeddedResourceSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { ContentBlock } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";

export { RunnableConfig };

const toolCallRequestSchema = z.object({
  serverName: z.string(),
  name: z.string(),
  args: z.unknown(),
});
export type ToolCallRequest = z.output<typeof toolCallRequestSchema>;

const toolResultSchema = z.tuple([
  z.custom<string | (ContentBlock | ContentBlock.Data.DataContentBlock)[]>(),
  z.array(
    z.union([
      EmbeddedResourceSchema,
      z.custom<ContentBlock.Data.DataContentBlock>(),
    ])
  ),
]);
export type ToolResult = z.output<typeof toolResultSchema>;

const toolCallResultSchema = z.object({
  ...toolCallRequestSchema.shape,
  result: toolResultSchema,
});
export type ToolCallResult = z.output<typeof toolCallResultSchema>;

const toolCallModificationSchema = z
  .object({
    header: z.record(z.string()),
    args: z.unknown(),
  })
  .partial();
export type ToolCallModification = z.output<typeof toolCallModificationSchema>;

export const interceptorSchema = z.object({
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
   *   beforeToolCall: (toolCallRequest) => {
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
    .args(toolCallRequestSchema, z.custom<RunnableConfig>())
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
   *   afterToolCall: (toolCallResult) => {
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
    .args(toolCallResultSchema, z.custom<RunnableConfig>())
    .returns(
      z.union([
        z.promise(toolCallResultSchema.pick({ result: true })),
        toolCallResultSchema.pick({ result: true }),
        z.void(),
        z.promise(z.void()),
      ])
    )
    .optional(),

  /**
   * Called when a log message is received.
   *
   * @param logMessage - The log message
   * @param logMessage.message - The log message
   * @param logMessage.level - The log level
   * @param logMessage.timestamp - The log timestamp
   * @returns The log message
   *
   * @example
   * ```ts
   * const interceptor = {
   *   onLog: (logMessage) => {
   *     console.log(logMessage);
   *   },
   * };
   * ```
   */
  onLog: z
    .function()
    .args(LoggingMessageNotificationSchema)
    .returns(z.union([z.void(), z.promise(z.void())]))
    .optional(),

  /**
   * Called when a progress message is received.
   *
   * @param progress - The progress message
   * @param progress.message - The progress message
   * @param progress.percentage - The progress percentage
   * @param progress.timestamp - The progress timestamp
   * @returns The progress message
   *
   * @example
   * ```ts
   * const interceptor = {
   *   onProgress: (progress) => {
   *     console.log(progress);
   *   },
   * };
   * ```
   */
  onProgress: z
    .function()
    .args(ProgressSchema)
    .returns(z.union([z.void(), z.promise(z.void())]))
    .optional(),
});
export type Interceptor = z.input<typeof interceptorSchema>;
