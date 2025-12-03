import { tool } from "@langchain/core/tools";
import type { DynamicStructuredTool, ToolRuntime } from "@langchain/core/tools";

import type {
  TextEditor20250728Command,
  TextEditor20250124Command,
} from "./types.js";

/**
 * Options for the text editor tool (Claude 4.x version).
 */
export interface TextEditor20250728Options {
  /**
   * Optional execute function that handles text editor command execution.
   * This function receives the command input and should return the result.
   */
  execute?: (args: TextEditor20250728Command) => string | Promise<string>;
  /**
   * Optional maximum characters to return when viewing files.
   * If the file content exceeds this limit, it will be truncated.
   */
  maxCharacters?: number;
}

/**
 * Options for the text editor tool (Claude 3.7 version).
 */
export interface TextEditor20250124Options {
  /**
   * Optional execute function that handles text editor command execution.
   * This function receives the command input and should return the result.
   */
  execute?: (args: TextEditor20250124Command) => string | Promise<string>;
}

/**
 * Creates an Anthropic text editor tool for Claude 4.x models that can view and modify text files.
 *
 * The text editor tool enables Claude to view and modify text files, helping debug, fix,
 * and improve code or other text documents. Claude can directly interact with files,
 * providing hands-on assistance rather than just suggesting changes.
 *
 * Available commands:
 * - `view`: Examine file contents or list directory contents
 * - `str_replace`: Replace specific text in a file
 * - `create`: Create a new file with specified content
 * - `insert`: Insert text at a specific line number
 *
 * @example
 * ```typescript
 * import { ChatAnthropic, tools } from "@langchain/anthropic";
 * import * as fs from "fs";
 *
 * const llm = new ChatAnthropic({
 *   model: "claude-sonnet-4-5-20250929",
 *   clientOptions: {
 *     defaultHeaders: {
 *       "anthropic-beta": "text-editor-20250728",
 *     },
 *   },
 * });
 *
 * const textEditor = tools.textEditor_20250728({
 *   execute: async (args) => {
 *     if (args.command === "view") {
 *       const content = fs.readFileSync(args.path, "utf-8");
 *       return content.split("\n").map((line, i) => `${i + 1}: ${line}`).join("\n");
 *     }
 *     if (args.command === "str_replace") {
 *       let content = fs.readFileSync(args.path, "utf-8");
 *       content = content.replace(args.old_str!, args.new_str!);
 *       fs.writeFileSync(args.path, content);
 *       return "Successfully replaced text.";
 *     }
 *     // Handle other commands...
 *     return "Command executed";
 *   },
 *   maxCharacters: 10000,
 * });
 *
 * const llmWithEditor = llm.bindTools([textEditor]);
 * const response = await llmWithEditor.invoke(
 *   "There's a syntax error in my primes.py file. Can you help me fix it?"
 * );
 * ```
 *
 * @param options - Configuration options for the text editor tool
 * @param options.execute - Function that handles text editor command execution
 * @param options.maxCharacters - Maximum characters to return when viewing files
 * @returns The text editor tool object that can be passed to `bindTools`
 *
 * @see https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/text-editor-tool
 */
export function textEditor_20250728(
  options?: TextEditor20250728Options
): DynamicStructuredTool {
  const name = "str_replace_based_edit_tool";
  const textEditorTool = tool(
    options?.execute as (
      input: unknown,
      runtime: ToolRuntime<unknown, unknown>
    ) => string | Promise<string>,
    {
      name,
      schema: {
        type: "object",
        properties: {
          command: {
            type: "string",
            enum: ["view", "str_replace", "create", "insert"],
          },
          path: {
            type: "string",
          },
        },
        required: ["command", "path"],
      },
    }
  );

  textEditorTool.extras = {
    ...(textEditorTool.extras ?? {}),
    providerToolDefinition: {
      type: "text_editor_20250728",
      name,
      ...(options?.maxCharacters !== undefined && {
        max_characters: options.maxCharacters,
      }),
    },
  };

  return textEditorTool;
}

/**
 * Creates an Anthropic text editor tool for Claude 3.7 models that can view and modify text files.
 *
 * The text editor tool enables Claude to view and modify text files, helping debug, fix,
 * and improve code or other text documents. Claude can directly interact with files,
 * providing hands-on assistance rather than just suggesting changes.
 *
 * Available commands:
 * - `view`: Examine file contents or list directory contents
 * - `str_replace`: Replace specific text in a file
 * - `create`: Create a new file with specified content
 * - `insert`: Insert text at a specific line number
 * - `undo_edit`: Revert the last edit made to a file (only available in Claude 3.7)
 *
 * @example
 * ```typescript
 * import { ChatAnthropic, tools } from "@langchain/anthropic";
 * import * as fs from "fs";
 *
 * const llm = new ChatAnthropic({
 *   model: "claude-3-7-sonnet-20250219",
 *   clientOptions: {
 *     defaultHeaders: {
 *       "anthropic-beta": "text-editor-20250124",
 *     },
 *   },
 * });
 *
 * const textEditor = tools.textEditor_20250124({
 *   execute: async (args) => {
 *     if (args.command === "view") {
 *       const content = fs.readFileSync(args.path, "utf-8");
 *       return content.split("\n").map((line, i) => `${i + 1}: ${line}`).join("\n");
 *     }
 *     if (args.command === "str_replace") {
 *       let content = fs.readFileSync(args.path, "utf-8");
 *       content = content.replace(args.old_str!, args.new_str!);
 *       fs.writeFileSync(args.path, content);
 *       return "Successfully replaced text.";
 *     }
 *     // Handle other commands...
 *     return "Command executed";
 *   },
 * });
 *
 * const llmWithEditor = llm.bindTools([textEditor]);
 * const response = await llmWithEditor.invoke(
 *   "There's a syntax error in my primes.py file. Can you help me fix it?"
 * );
 * ```
 *
 * @param options - Configuration options for the text editor tool
 * @param options.execute - Function that handles text editor command execution
 * @returns The text editor tool object that can be passed to `bindTools`
 *
 * @see https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/text-editor-tool
 */
export function textEditor_20250124(
  options?: TextEditor20250124Options
): DynamicStructuredTool {
  const name = "str_replace_editor";
  const textEditorTool = tool(
    options?.execute as (
      input: unknown,
      runtime: ToolRuntime<unknown, unknown>
    ) => string | Promise<string>,
    {
      name,
      schema: {
        type: "object",
        properties: {
          command: {
            type: "string",
            enum: ["view", "str_replace", "create", "insert", "undo_edit"],
          },
          path: {
            type: "string",
          },
        },
        required: ["command", "path"],
      },
    }
  );

  textEditorTool.extras = {
    ...(textEditorTool.extras ?? {}),
    providerToolDefinition: {
      type: "text_editor_20250124",
      name,
    },
  };

  return textEditorTool;
}
