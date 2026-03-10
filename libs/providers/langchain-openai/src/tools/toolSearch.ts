import { OpenAI as OpenAIClient } from "openai";
import type { ServerTool } from "@langchain/core/tools";

export interface ToolSearchOptions {
  /**
   * Whether tool search is executed by the server or by the client.
   * - `"server"` (default): OpenAI's servers handle the search internally.
   * - `"client"`: The client provides results via agent middleware.
   */
  execution?: "server" | "client";
  /**
   * Description shown to the model for a client-executed tool search tool.
   */
  description?: string;
  /**
   * Parameter schema for a client-executed tool search tool.
   */
  parameters?: unknown;
}

export type ToolSearchTool = OpenAIClient.Responses.ToolSearchTool;

/**
 * Creates a tool search tool that enables OpenAI models to dynamically discover
 * and load tools on-demand from a large pool, rather than requiring all tool
 * definitions to be sent in every request.
 *
 * Tool search works with tools that have `defer_loading: true` set (either
 * directly in the tool definition or via `extras: { defer_loading: true }` on
 * LangChain tools). When the model needs a deferred tool, it issues a tool
 * search call, discovers matching tools, and then makes the actual function call.
 *
 * @see {@link https://platform.openai.com/docs/guides/tools-tool-search | OpenAI Tool Search Documentation}
 * @param options - Configuration options for the tool search tool
 * @returns A tool search tool definition to be passed to the OpenAI Responses API
 *
 * @example
 * ```typescript
 * import { ChatOpenAI, tools } from "@langchain/openai";
 * import { tool } from "@langchain/core/tools";
 * import { z } from "zod";
 *
 * const model = new ChatOpenAI({ model: "gpt-4o" });
 *
 * const getWeather = tool(
 *   async (input) => `Weather in ${input.location}: sunny, 72°F`,
 *   {
 *     name: "get_weather",
 *     description: "Get the current weather for a location",
 *     schema: z.object({ location: z.string() }),
 *     extras: { defer_loading: true },
 *   }
 * );
 *
 * // Server-executed tool search (default)
 * const response = await model.invoke("What is the weather in SF?", {
 *   tools: [tools.toolSearch(), getWeather],
 * });
 *
 * // Client-executed tool search
 * const clientResponse = await model.invoke("What is the weather in SF?", {
 *   tools: [
 *     tools.toolSearch({
 *       execution: "client",
 *       description: "Search for available tools",
 *       parameters: {
 *         type: "object",
 *         properties: { goal: { type: "string" } },
 *         required: ["goal"],
 *       },
 *     }),
 *     getWeather,
 *   ],
 * });
 * ```
 */
export function toolSearch(options?: ToolSearchOptions): ServerTool {
  return {
    type: "tool_search",
    ...(options?.execution ? { execution: options.execution } : {}),
    ...(options?.description ? { description: options.description } : {}),
    ...(options?.parameters !== undefined
      ? { parameters: options.parameters }
      : {}),
  } satisfies ToolSearchTool;
}
