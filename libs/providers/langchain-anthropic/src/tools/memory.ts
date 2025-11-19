import { tool } from "@langchain/core/tools";
import type { DynamicStructuredTool, ToolRuntime } from "@langchain/core/tools";

import { StateFileSystem } from "./utils/StateFileSystem.js";
import { CommandHandler } from "./utils/CommandHandler.js";
import { handleMemoryCommand } from "./utils/index.js";
import type { FileData } from "./utils/FileData.js";
import type { FileSystem } from "./utils/FileSystem.js";
import type { MemoryTool20250818Options } from "./types.js";

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
 *   model: "claude-sonnet-4-5-20250929",
 *   clientOptions: {
 *     defaultHeaders: {
 *       "anthropic-beta": "context-management-2025-06-27",
 *     },
 *   },
 * });
 *
 * const memory = memory_20250818();
 * const llmWithMemory = llm.bindTools([memory]);
 *
 * const response = await llmWithMemory.invoke("Remember that I like Python");
 * ```
 *
 * @param options - Optional configuration for the memory tool (currently unused)
 * @returns The memory tool object that can be passed to `bindTools`
 *
 * @see https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/memory-tool
 */
export function memory_20250818(
  options?: MemoryTool20250818Options
): DynamicStructuredTool {
  const memoryTool = tool(
    options?.execute as (
      input: unknown,
      runtime: ToolRuntime<unknown, unknown>
    ) => string | Promise<string>,
    {
      name: "memory",
      description: "Memory tool",
      schema: {
        type: "object",
        properties: {
          command: {
            type: "string",
            enum: [
              "view",
              "create",
              "str_replace",
              "insert",
              "delete",
              "rename",
            ],
          },
        },
        required: ["command"],
      },
    }
  );

  memoryTool.metadata = {
    providerToolDefinition: {
      type: "memory_20250818",
      name: "memory",
    },
  };

  return memoryTool;
}

interface MemoryToolOptions {
  allowedPrefixes?: string[];
  filesystem?: FileSystem;
}

/**
 * useful implementation
 */
export function memory(options?: MemoryToolOptions): DynamicStructuredTool {
  const filesystem: Record<string, FileData> = {};
  return memory_20250818({
    execute: async (args) => {
      const updates: Record<string, FileData | null> = {};
      const fileSystem =
        options?.filesystem ??
        new StateFileSystem(filesystem, options?.allowedPrefixes, (files) => {
          Object.assign(updates, files);
        });
      const commandHandler = new CommandHandler(fileSystem);
      return await handleMemoryCommand(commandHandler, args);
    },
  });
}
