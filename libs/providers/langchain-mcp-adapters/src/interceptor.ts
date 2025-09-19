import { z } from "zod/v3";
import type { ContentBlock } from "@langchain/core/messages";
import {
  LoggingMessageNotificationSchema,
  ProgressSchema,
} from "@modelcontextprotocol/sdk/types.js";

const toolInfoSchema = z.object({
  serverName: z.string(),
  name: z.string(),
  args: z.unknown(),
});

const toolInfoResultSchema = z.object({
  ...toolInfoSchema.shape,
  result: z.custom<ContentBlock>(),
});

const toolCallInterceptionSchema = z.object({
  toolInfo: toolInfoSchema,
  header: z.record(z.string()),
});

export const interceptorSchema = z.object({
  /**
   * Called before a tool call is made.
   * Allows you to modify the tool call arguments or return a different tool call.
   *
   * @example
   * ```ts
   * const interceptor = {
   *   beforeToolCall: (toolInfo) => {
   *     return { toolInfo, header: { "X-Custom-Header": "Custom Value" } };
   *   },
   * };
   * ```
   */
  beforeToolCall: z
    .function()
    .args(toolInfoSchema)
    .returns(
      z.union([
        z.promise(toolCallInterceptionSchema),
        toolCallInterceptionSchema,
      ])
    )
    .optional(),

  /**
   * Called after a tool call is made.
   * Allows you to modify the tool call result or return a different tool call result.
   *
   * @example
   * ```ts
   * const interceptor = {
   *   afterToolCall: (toolInfoResult) => {
   *     toolInfoResult.result = "Custom Value";
   *     return { toolInfoResult };
   *   },
   * };
   * ```
   */
  afterToolCall: z
    .function()
    .args(toolInfoResultSchema)
    .returns(z.promise(z.unknown()))
    .optional(),

  /**
   * Called when a log message is received.
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

export type Interceptor = z.output<typeof interceptorSchema>;
