import { expect, it, describe } from "vitest";
import {
  HumanMessage,
  ToolMessage,
  AIMessage,
  type BaseMessage,
} from "@langchain/core/messages";

import { ChatAnthropic, type AnthropicInput } from "../../chat_models.js";
import { textEditor_20250728 } from "../textEditor.js";

const createModel = (args: AnthropicInput = {}) =>
  new ChatAnthropic({
    model: "claude-sonnet-4-5",
    temperature: 0,
    ...args,
  });

// Mock file system for testing
const mockFileSystem: Record<string, string> = {
  "primes.py": `def is_prime(n):
    """Check if a number is prime."""
    if n <= 1:
        return False
    if n <= 3:
        return True
    if n % 2 == 0 or n % 3 == 0:
        return False
    i = 5
    while i * i <= n:
        if n % i == 0 or n % (i + 2) == 0:
            return False
        i += 6
    return True

def get_primes(limit):
    """Generate a list of prime numbers up to the given limit."""
    primes = []
    for num in range(2, limit + 1)
        if is_prime(num):
            primes.append(num)
    return primes
`,
  "src/utils.py": `def helper():
    return "helper"
`,
  "src/main.py": `from utils import helper
print(helper())
`,
};

// Mock directory structure
const mockDirectories: Record<string, string[]> = {
  ".": ["primes.py", "src/"],
  src: ["utils.py", "main.py"],
  "src/": ["utils.py", "main.py"],
};

/**
 * Check if a path is a directory in the mock file system
 */
function isDirectory(path: string): boolean {
  const normalizedPath = path.replace(/\/$/, "");
  return normalizedPath in mockDirectories || normalizedPath === ".";
}

/**
 * List directory contents
 */
function listDirectory(path: string): string {
  const normalizedPath = path.replace(/\/$/, "") || ".";
  const contents = mockDirectories[normalizedPath];
  if (!contents) {
    return `Error: Directory not found: ${path}`;
  }
  return contents.join("\n");
}

/**
 * Get file contents with line numbers
 */
function getFileContents(path: string): string {
  const content = mockFileSystem[path];
  if (!content) {
    return `Error: File not found: ${path}`;
  }
  return content
    .split("\n")
    .map((line, i) => `${i + 1}: ${line}`)
    .join("\n");
}

describe("Anthropic Text Editor Tool Integration Tests", () => {
  it("text editor tool can be bound to ChatAnthropic and triggers tool use for view", async () => {
    const llm = createModel();

    const textEditor = textEditor_20250728({
      execute: async (args) => {
        if (args.command === "view") {
          // Check if path is a directory or file
          if (isDirectory(args.path)) {
            return listDirectory(args.path);
          }
          return getFileContents(args.path);
        }
        return "Command not implemented in test";
      },
    });

    const llmWithEditor = llm.bindTools([textEditor]);

    const initialMessage = new HumanMessage(
      "There's a syntax error in my primes.py file. Can you help me fix it?"
    );
    const messages: BaseMessage[] = [initialMessage];
    while (true) {
      const viewResponse = await llmWithEditor.invoke(messages);
      const toolCall = viewResponse.tool_calls?.[0];
      messages.push(viewResponse);
      if (
        !toolCall ||
        toolCall.name !== "str_replace_based_edit_tool" ||
        toolCall.args.command !== "view"
      ) {
        break;
      }

      messages.push(
        new ToolMessage({
          tool_call_id: toolCall?.id ?? "",
          content: await textEditor.invoke(toolCall?.args ?? ""),
        })
      );
    }

    expect(AIMessage.isInstance(messages.at(-1))).toBe(true);
    expect((messages.at(-1) as AIMessage).tool_calls?.[0]).toEqual(
      expect.objectContaining({
        name: "str_replace_based_edit_tool",
        args: {
          command: "str_replace",
          path: "primes.py",
          old_str: "    for num in range(2, limit + 1)",
          new_str: "    for num in range(2, limit + 1):",
        },
        id: expect.any(String),
        type: "tool_call",
      })
    );
  }, 60000);
});
