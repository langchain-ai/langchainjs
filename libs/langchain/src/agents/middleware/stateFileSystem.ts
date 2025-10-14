/**
 * Tool functions for Deep Agents
 *
 * TypeScript versions of all tools using @langchain/core/tools tool() function.
 * Uses getCurrentTaskInput() for state access and returns Command objects for state updates.
 * Implements mock filesystem operations using state.files similar to Python version.
 */

import { z } from "zod/v3";
import { Command, getCurrentTaskInput } from "@langchain/langgraph";
import { ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { type AgentMiddleware } from "./types.js";

import { createMiddleware } from "../index.js";

export type { AgentMiddleware };

/**
 * Description for the edit_file tool
 * Ported exactly from Python EDIT_DESCRIPTION
 */
export const EDIT_DESCRIPTION = `Performs exact string replacements in files.
Usage:

You must use your Read tool at least once in the conversation before editing. This tool will error if you attempt an edit without reading the file.
When editing text from Read tool output, ensure you preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix format is: spaces + line number + tab. Everything after that tab is the actual file content to match. Never include any part of the line number prefix in the old_string or new_string.
ALWAYS prefer editing existing files. NEVER write new files unless explicitly required.
Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
The edit will FAIL if old_string is not unique in the file. Either provide a larger string with more surrounding context to make it unique or use replace_all to change every instance of old_string.
Use replace_all for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.`;

/**
 * Description for the read_file tool
 * Ported exactly from Python TOOL_DESCRIPTION
 */
export const TOOL_DESCRIPTION = `Reads a file from the local filesystem. You can access any file directly by using this tool. Assume this tool is able to read all files on the machine. If the User provides a path to a file assume that path is valid. It is okay to read a file that does not exist; an error will be returned.
Usage:

The file_path parameter must be an absolute path, not a relative path
By default, it reads up to 2000 lines starting from the beginning of the file
You can optionally specify a line offset and limit (especially handy for long files), but it's recommended to read the whole file by not providing these parameters
Any lines longer than 2000 characters will be truncated
Results are returned using cat -n format, with line numbers starting at 1
You have the capability to call multiple tools in a single response. It is always better to speculatively read multiple files as a batch that are potentially useful.
If you read a file that exists but has empty contents you will receive a system reminder warning in place of file contents.`;

const systemPrompt = `## Filesystem Tools \`ls\`, \`read_file\`, \`write_file\`, \`edit_file\`

You have access to a local, private filesystem which you can interact with using these tools.
- ls: list all files in the local filesystem
- read_file: read a file from the local filesystem
- write_file: write to a file in the local filesystem
- edit_file: edit a file in the local filesystem`;

const stateSchema = z.object({
  files: z.record(z.string(), z.string()).default({}),
});
export type StateFileSystemMiddlewareState = z.infer<typeof stateSchema>;

/**
 * List files tool - returns list of files from state.files
 * Equivalent to Python's ls function
 */
const ls = tool(
  () => {
    const state = getCurrentTaskInput<StateFileSystemMiddlewareState>();
    const files = state.files || {};
    return Object.keys(files);
  },
  {
    name: "ls",
    description: "List all files in the mock filesystem",
    schema: z.object({}),
  }
);

/**
 * Read file tool - reads from mock filesystem in state.files
 * Matches Python read_file function behavior exactly
 */
const readFile = tool(
  (input: { file_path: string; offset?: number; limit?: number }) => {
    const state = getCurrentTaskInput<StateFileSystemMiddlewareState>();
    const mockFilesystem = state.files || {};
    const { file_path, offset = 0, limit = 2000 } = input;

    if (!(file_path in mockFilesystem)) {
      return `Error: File '${file_path}' not found`;
    }

    // Get file content
    const content = mockFilesystem[file_path];

    // Handle empty file
    if (!content || content.trim() === "") {
      return "System reminder: File exists but has empty contents";
    }

    // Split content into lines
    const lines = content.split("\n");

    // Apply line offset and limit
    const startIdx = offset;
    const endIdx = Math.min(startIdx + limit, lines.length);

    // Handle case where offset is beyond file length
    if (startIdx >= lines.length) {
      return `Error: Line offset ${offset} exceeds file length (${lines.length} lines)`;
    }

    // Format output with line numbers (cat -n format)
    const resultLines: string[] = [];
    for (let i = startIdx; i < endIdx; i++) {
      let lineContent = lines[i];

      // Truncate lines longer than 2000 characters
      if (lineContent.length > 2000) {
        lineContent = lineContent.substring(0, 2000);
      }

      // Line numbers start at 1, so add 1 to the index
      const lineNumber = i + 1;
      resultLines.push(`${lineNumber.toString().padStart(6)}	${lineContent}`);
    }

    return resultLines.join("\n");
  },
  {
    name: "read_file",
    description: TOOL_DESCRIPTION,
    schema: z.object({
      file_path: z.string().describe("Absolute path to the file to read"),
      offset: z
        .number()
        .optional()
        .default(0)
        .describe("Line offset to start reading from"),
      limit: z
        .number()
        .optional()
        .default(2000)
        .describe("Maximum number of lines to read"),
    }),
  }
);

/**
 * Write file tool - writes to mock filesystem with Command return
 * Matches Python write_file function behavior exactly
 */
const writeFile = tool(
  (input: { file_path: string; content: string }, config) => {
    const state = getCurrentTaskInput<StateFileSystemMiddlewareState>();
    const files = { ...(state.files || {}) };
    files[input.file_path] = input.content;

    return new Command({
      update: {
        files: files,
        messages: [
          new ToolMessage({
            content: `Updated file ${input.file_path}`,
            tool_call_id: config.toolCall?.id as string,
            name: "write_file",
          }),
        ],
      },
    });
  },
  {
    name: "write_file",
    description: "Write content to a file in the mock filesystem",
    schema: z.object({
      file_path: z.string().describe("Absolute path to the file to write"),
      content: z.string().describe("Content to write to the file"),
    }),
  }
);

/**
 * Edit file tool - edits files in mock filesystem with Command return
 * Matches Python edit_file function behavior exactly
 */
const editFile = tool(
  (
    input: {
      file_path: string;
      old_string: string;
      new_string: string;
      replace_all?: boolean;
    },
    config
  ) => {
    const state = getCurrentTaskInput<StateFileSystemMiddlewareState>();
    const mockFilesystem = { ...(state.files || {}) };
    const { file_path, old_string, new_string, replace_all = false } = input;

    // Check if file exists in mock filesystem
    if (!(file_path in mockFilesystem)) {
      return `Error: File '${file_path}' not found`;
    }

    // Get current file content
    const content = mockFilesystem[file_path];

    // Check if old_string exists in the file
    if (!content.includes(old_string)) {
      return `Error: String not found in file: '${old_string}'`;
    }

    // If not replace_all, check for uniqueness
    if (!replace_all) {
      const escapedOldString = old_string.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
      const occurrences = (
        content.match(new RegExp(escapedOldString, "g")) || []
      ).length;
      if (occurrences > 1) {
        return `Error: String '${old_string}' appears ${occurrences} times in file. Use replace_all=True to replace all instances, or provide a more specific string with surrounding context.`;
      } else if (occurrences === 0) {
        return `Error: String not found in file: '${old_string}'`;
      }
    }

    // Perform the replacement
    let newContent: string;

    if (replace_all) {
      const escapedOldString = old_string.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
      newContent = content.replace(
        new RegExp(escapedOldString, "g"),
        new_string
      );
    } else {
      newContent = content.replace(old_string, new_string);
    }

    // Update the mock filesystem
    mockFilesystem[file_path] = newContent;

    return new Command({
      update: {
        files: mockFilesystem,
        messages: [
          new ToolMessage({
            content: `Updated file ${file_path}`,
            tool_call_id: config.toolCall?.id as string,
            name: "edit_file",
          }),
        ],
      },
    });
  },
  {
    name: "edit_file",
    description: EDIT_DESCRIPTION,
    schema: z.object({
      file_path: z.string().describe("Absolute path to the file to edit"),
      old_string: z
        .string()
        .describe("String to be replaced (must match exactly)"),
      new_string: z.string().describe("String to replace with"),
      replace_all: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to replace all occurrences"),
    }),
  }
);

export const stateFileSystemMiddleware = () =>
  createMiddleware({
    name: "StateFileSystemMiddleware",
    stateSchema,
    tools: [ls, readFile, writeFile, editFile],
    wrapModelCall: (request, handler) => {
      return handler({
        ...request,
        systemPrompt: request.systemPrompt + systemPrompt,
      });
    },
  });
