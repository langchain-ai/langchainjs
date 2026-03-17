/**
 * Headless Tools for LangChain Agents
 *
 * This module provides the `tool` primitive for creating headless tools that
 * interrupt agent execution and delegate their implementation to the client
 * (e.g. via `useStream({ tools: [...] })`).
 *
 * @module
 */

import {
  tool as coreTool,
  DynamicStructuredTool,
  type ToolRunnableConfig,
} from "@langchain/core/tools";
import type {
  InteropZodObject,
  InferInteropZodInput,
  InferInteropZodOutput,
} from "@langchain/core/utils/types";

/**
 * Configuration fields for creating a headless tool.
 */
export type HeadlessToolFields<
  SchemaT extends InteropZodObject,
  NameT extends string = string,
> = {
  /** The name of the tool. Used by the client to match implementations. */
  name: NameT;
  /** Description of what the tool does. */
  description: string;
  /** The Zod schema defining the tool's input. */
  schema: SchemaT;
};

/**
 * A tool implementation that pairs a headless tool with its execution function.
 *
 * Created by calling `.implement()` on a {@link HeadlessTool}.
 * Pass to `useStream({ tools: [...] })` on the client side.
 */
export type HeadlessToolImplementation<
  SchemaT extends InteropZodObject = InteropZodObject,
  OutputT = unknown,
  NameT extends string = string,
> = {
  tool: HeadlessTool<SchemaT, NameT>;
  execute: (args: InferInteropZodOutput<SchemaT>) => Promise<OutputT>;
};

/**
 * A headless tool that always interrupts agent execution on the server.
 *
 * The implementation is provided separately on the client via
 * `useStream({ tools: [...] })` using `.implement()`.
 */
export type HeadlessTool<
  SchemaT extends InteropZodObject = InteropZodObject,
  NameT extends string = string,
> = DynamicStructuredTool<
  SchemaT,
  InferInteropZodOutput<SchemaT>,
  InferInteropZodInput<SchemaT>,
  unknown,
  unknown,
  NameT
> & {
  /**
   * Pairs this headless tool with a client-side implementation.
   *
   * The returned object should be passed to `useStream({ tools: [...] })`.
   * The SDK matches the implementation to the tool by name and calls
   * `execute` with the typed arguments from the interrupt payload.
   *
   * @param execute - The function that implements the tool on the client
   */
  implement: <OutputT>(
    execute: (args: InferInteropZodOutput<SchemaT>) => Promise<OutputT>
  ) => HeadlessToolImplementation<SchemaT, OutputT, NameT>;
};

/**
 * Creates a headless tool that interrupts agent execution on the server.
 *
 * Headless tools are defined without an implementation. When the agent calls
 * the tool, execution is interrupted and the tool call details are surfaced to
 * the client. The client provides the implementation separately via
 * `useStream({ tools: [...] })`.
 *
 * @example
 * ```typescript
 * import { tool } from "langchain/tools";
 * import { z } from "zod";
 *
 * // Define the headless tool — no implementation needed here
 * export const getLocation = tool({
 *   name: "get_location",
 *   description: "Get the user's current GPS location",
 *   schema: z.object({
 *     highAccuracy: z.boolean().optional().describe("Request high accuracy GPS"),
 *   }),
 * });
 *
 * // Use in createAgent (server)
 * const agent = createAgent({
 *   model: "openai:gpt-4o",
 *   tools: [getLocation],
 * });
 *
 * // Provide the implementation in useStream (client)
 * const stream = useStream({
 *   assistantId: "agent",
 *   tools: [
 *     getLocation.implement(async ({ highAccuracy }) => {
 *       return new Promise((resolve, reject) => {
 *         navigator.geolocation.getCurrentPosition(
 *           (pos) => resolve({
 *             latitude: pos.coords.latitude,
 *             longitude: pos.coords.longitude,
 *           }),
 *           (err) => reject(new Error(err.message)),
 *           { enableHighAccuracy: highAccuracy }
 *         );
 *       });
 *     }),
 *   ],
 * });
 * ```
 *
 * @param fields - The tool configuration (name, description, schema)
 * @returns A headless tool that interrupts on every invocation
 */
export function tool<
  SchemaT extends InteropZodObject,
  NameT extends string,
>(
  fields: HeadlessToolFields<SchemaT, NameT>
): HeadlessTool<SchemaT, NameT> {
  const { name, description, schema } = fields;

  const wrappedTool = coreTool(
    async (
      args: InferInteropZodOutput<SchemaT>,
      config?: ToolRunnableConfig
    ) => {
      const { interrupt } = await import("@langchain/langgraph");
      return interrupt({
        type: "tool",
        toolCall: {
          id: config?.toolCall?.id,
          name,
          args,
        },
      });
    },
    {
      name,
      description,
      schema,
      metadata: {
        headlessTool: true,
      },
    }
  );

  const headlessTool: HeadlessTool<SchemaT, NameT> = Object.assign(wrappedTool, {
    implement: <OutputT>(
      execute: (args: InferInteropZodOutput<SchemaT>) => Promise<OutputT>
    ): HeadlessToolImplementation<SchemaT, OutputT, NameT> => ({
      tool: headlessTool,
      execute,
    }),
  }) as HeadlessTool<SchemaT, NameT>;

  return headlessTool;
}
