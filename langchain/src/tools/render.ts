import { StructuredTool } from "./base.js";

/**
 * Render the tool name and description in plain text.
 *
 * Output will be in the format of:
 * ```
 * search: This tool is used for search
 * calculator: This tool is used for math
 * ```
 * @param tools
 * @returns a string of all tools and their descriptions
 */
export function renderTextDescription(tools: StructuredTool[]): string {
  return tools.map((tool) => `${tool.name}: ${tool.description}`).join("\n");
}
