import Anthropic from "@anthropic-ai/sdk";
import { type ServerTool } from "@langchain/core/tools";

/**
 * Options for the code execution tool.
 */
export interface CodeExecution20250825Options {
  /**
   * Create a cache control breakpoint at this content block.
   */
  cacheControl?: Anthropic.Beta.BetaCacheControlEphemeral;
}

/**
 * Creates a code execution tool that allows Claude to run Bash commands and manipulate files
 * in a secure, sandboxed environment. Claude can analyze data, create visualizations,
 * perform calculations, and process files.
 *
 * When this tool is provided, Claude automatically gains access to:
 * - **Bash commands**: Execute shell commands for system operations
 * - **File operations**: Create, view, and edit files directly
 *
 * @note This tool requires the beta header `code-execution-2025-08-25` in API requests.
 *
 * @see {@link https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/code-execution-tool | Anthropic Code Execution Documentation}
 * @param options - Configuration options for the code execution tool
 * @returns A code execution tool definition to be passed to the Anthropic API
 *
 * @example
 * ```typescript
 * import { ChatAnthropic, tools } from "@langchain/anthropic";
 *
 * const model = new ChatAnthropic({
 *   model: "claude-sonnet-4-5-20250929",
 * });
 *
 * // Basic usage - calculations and data analysis
 * const response = await model.invoke(
 *   "Calculate the mean and standard deviation of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]",
 *   { tools: [tools.codeExecution_20250825()] }
 * );
 *
 * // File operations and visualization
 * const response2 = await model.invoke(
 *   "Create a matplotlib visualization of sales data and save it as chart.png",
 *   { tools: [tools.codeExecution_20250825()] }
 * );
 * ```
 *
 * @example Container reuse
 * ```typescript
 * // First request - creates a container
 * const response1 = await model.invoke(
 *   "Write a random number to /tmp/number.txt",
 *   { tools: [tools.codeExecution_20250825()] }
 * );
 *
 * // Extract container ID from response for reuse
 * const containerId = response1.response_metadata?.container?.id;
 *
 * // Second request - reuse container to access the file
 * const response2 = await model.invoke(
 *   "Read /tmp/number.txt and calculate its square",
 *   {
 *     tools: [tools.codeExecution_20250825()],
 *     // Pass container ID to reuse the same environment
 *   }
 * );
 * ```
 */
export function codeExecution_20250825(
  options?: CodeExecution20250825Options
): ServerTool {
  return {
    type: "code_execution_20250825",
    name: "code_execution",
    cache_control: options?.cacheControl,
  } satisfies Anthropic.Beta.BetaCodeExecutionTool20250825;
}
