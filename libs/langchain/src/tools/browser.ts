/**
 * Browser Tools for LangChain Agents
 *
 * This module provides the `browserTool` primitive for creating tools that
 * execute in the browser while the agent runs on the server.
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
  InferInteropZodOutput,
} from "@langchain/core/utils/types";
import { interrupt } from "@langchain/langgraph";

/**
 * Check if we're running in a browser environment.
 */
const isBrowserEnvironment = (): boolean =>
  typeof window !== "undefined" &&
  typeof navigator !== "undefined" &&
  typeof document !== "undefined";

/**
 * Parameters for creating a browser tool.
 */
export interface BrowserToolParams<
  SchemaT extends InteropZodObject,
  OutputT = unknown
> {
  /**
   * The name of the tool. Must be unique across all tools.
   */
  name: string;

  /**
   * A description of what the tool does. This is shown to the LLM
   * to help it decide when to use the tool.
   */
  description: string;

  /**
   * The Zod schema defining the input parameters for the tool.
   */
  schema: SchemaT;

  /**
   * The function that executes the tool in the browser.
   * This function only runs in browser environments.
   *
   * @param args - The parsed input arguments matching the schema
   * @returns The tool output
   */
  execute: (args: InferInteropZodOutput<SchemaT>) => Promise<OutputT>;
}

/**
 * A browser tool that can be used in both server and client environments.
 *
 * On the server, it returns a Command that interrupts execution.
 * On the client, it executes the tool directly.
 */
export type BrowserTool<
  SchemaT extends InteropZodObject = InteropZodObject,
  OutputT = unknown
> = DynamicStructuredTool<SchemaT> & {
  /**
   * The execute function for client-side use.
   * Called by `useStream` when the interrupt is received.
   */
  execute: (args: InferInteropZodOutput<SchemaT>) => Promise<OutputT>;
};

/**
 * Creates a browser tool that interrupts on the server and executes on the client.
 *
 * Browser tools are defined once and work in both environments:
 * - **Server**: Returns a `Command` that interrupts with the tool call details
 * - **Browser**: Executes the tool directly using browser APIs
 *
 * @example
 * ```typescript
 * import { browserTool } from "langchain/tools/browser";
 * import { z } from "zod";
 *
 * export const getLocation = browserTool({
 *   name: "get_location",
 *   description: "Get the user's current GPS location",
 *   schema: z.object({
 *     highAccuracy: z.boolean().optional().describe("Request high accuracy GPS"),
 *   }),
 *   execute: async ({ highAccuracy }) => {
 *     return new Promise((resolve, reject) => {
 *       navigator.geolocation.getCurrentPosition(
 *         (pos) => resolve({
 *           latitude: pos.coords.latitude,
 *           longitude: pos.coords.longitude,
 *         }),
 *         (err) => reject(new Error(err.message)),
 *         { enableHighAccuracy: highAccuracy }
 *       );
 *     });
 *   },
 * });
 *
 * // Use in createAgent (server)
 * const agent = createAgent({
 *   model: "openai:gpt-4o",
 *   tools: [getLocation],
 * });
 *
 * // Use in useStream (client)
 * const stream = useStream({
 *   assistantId: "agent",
 *   browserTools: [getLocation],
 * });
 * ```
 *
 * @param params - The browser tool configuration
 * @returns A browser tool that can be used in both environments
 */
export function browserTool<
  SchemaT extends InteropZodObject,
  OutputT = unknown
>(params: BrowserToolParams<SchemaT, OutputT>): BrowserTool<SchemaT, OutputT> {
  const { execute, name, description, schema } = params;

  // Create the underlying tool using @langchain/core's tool function
  const wrappedTool = coreTool(
    async (
      args: InferInteropZodOutput<SchemaT>,
      config?: ToolRunnableConfig
    ) => {
      // In browser: execute the tool directly
      if (isBrowserEnvironment()) {
        return execute(args);
      }

      // On server: interrupt and wait for client to execute
      // The interrupt value contains the tool call details for the client
      return interrupt({
        type: "browser_tool",
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
      // Mark as browser tool in metadata for detection
      metadata: {
        browserTool: true,
      },
    }
  );

  // Attach the execute function for explicit client-side use (e.g., in useStream)
  return Object.assign(wrappedTool, { execute }) as BrowserTool<
    SchemaT,
    OutputT
  >;
}
