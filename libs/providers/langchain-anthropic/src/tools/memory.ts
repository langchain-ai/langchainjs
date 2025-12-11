import Anthropic from "@anthropic-ai/sdk";
import { tool } from "@langchain/core/tools";
import type { DynamicStructuredTool, ToolRuntime } from "@langchain/core/tools";

import {
  Memory20250818CommandSchema,
  type MemoryTool20250818Options,
  type Memory20250818Command,
} from "./types.js";

/**
 * Creates an Anthropic memory tool that can be used with ChatAnthropic.
 *
 * The memory tool enables Claude to store and retrieve information across conversations
 * through a memory file directory. Claude can create, read, update, and delete files that
 * persist between sessions, allowing it to build knowledge over time without keeping
 * everything in the context window.
 *
 * @example
 * ```typescript
 * import { ChatAnthropic, memory_20250818 } from "@langchain/anthropic";
 *
 * const llm = new ChatAnthropic({
 *   model: "claude-sonnet-4-5-20250929"
 * });
 *
 * const memory = memory_20250818({
 *   execute: async (args) => {
 *     // handle memory command execution
 *     // ...
 *   },
 * });
 * const llmWithMemory = llm.bindTools([memory]);
 *
 * const response = await llmWithMemory.invoke("Remember that I like Python");
 * ```
 *
 * @param options - Optional configuration for the memory tool (currently unused)
 * @param options.execute - Optional execute function that handles memory command execution.
 * @returns The memory tool object that can be passed to `bindTools`
 *
 * @see https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/memory-tool
 */
export function memory_20250818(options?: MemoryTool20250818Options) {
  const memoryTool = tool(
    options?.execute as (
      input: unknown,
      runtime: ToolRuntime<unknown, unknown>
    ) => string | Promise<string>,
    {
      name: "memory",
      schema: Memory20250818CommandSchema,
    }
  );

  memoryTool.extras = {
    ...(memoryTool.extras ?? {}),
    providerToolDefinition: {
      type: "memory_20250818",
      name: "memory",
    } satisfies Anthropic.Beta.BetaMemoryTool20250818,
  };

  return memoryTool as DynamicStructuredTool<
    typeof Memory20250818CommandSchema,
    Memory20250818Command,
    unknown,
    string | Promise<string>
  >;
}
