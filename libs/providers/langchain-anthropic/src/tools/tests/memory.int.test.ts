import { expect, test, describe } from "vitest";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";

import { ChatAnthropic } from "../../chat_models.js";
import { memory_20250818 } from "../memory.js";
import type { Memory20250818Command } from "../types.js";

/**
 * Simple in-memory file system for testing memory tool operations.
 * Normalizes paths by removing leading slashes to handle both "/file.txt" and "file.txt".
 */
class MockMemoryFileSystem {
  private files: Map<string, string> = new Map();

  private normalizePath(path?: string): string {
    // Handle undefined/null path - default to root
    if (!path) {
      return "";
    }
    // Remove leading slash and normalize
    return path.replace(/^\/+/, "");
  }

  view(path?: string): string {
    const normalizedPath = this.normalizePath(path);
    if (normalizedPath === "" || path === "/" || !path) {
      const entries = Array.from(this.files.keys());
      if (entries.length === 0) {
        return "Directory is empty.";
      }
      return entries.join("\n");
    }
    const content = this.files.get(normalizedPath);
    if (content === undefined) {
      return `Error: File not found: ${path}`;
    }
    return content;
  }

  create(path?: string, fileText?: string): string {
    if (!path) {
      return "Error: Path is required for create command";
    }
    const normalizedPath = this.normalizePath(path);
    if (this.files.has(normalizedPath)) {
      return `Error: File already exists: ${path}`;
    }
    this.files.set(normalizedPath, fileText ?? "");
    return `Successfully created file: ${path}`;
  }

  strReplace(path?: string, oldStr?: string, newStr?: string): string {
    if (!path) {
      return "Error: Path is required for str_replace command";
    }
    const normalizedPath = this.normalizePath(path);
    const content = this.files.get(normalizedPath);
    if (content === undefined) {
      return `Error: File not found: ${path}`;
    }
    if (!oldStr || !content.includes(oldStr)) {
      return `Error: String not found in file: ${oldStr}`;
    }
    this.files.set(normalizedPath, content.replace(oldStr, newStr ?? ""));
    return `Successfully replaced text in: ${path}`;
  }

  insert(path?: string, insertLine?: number, insertText?: string): string {
    if (!path) {
      return "Error: Path is required for insert command";
    }
    const normalizedPath = this.normalizePath(path);
    const content = this.files.get(normalizedPath);
    if (content === undefined) {
      return `Error: File not found: ${path}`;
    }
    const lines = content.split("\n");
    lines.splice(insertLine ?? 0, 0, insertText ?? "");
    this.files.set(normalizedPath, lines.join("\n"));
    return `Successfully inserted text at line ${insertLine ?? 0} in: ${path}`;
  }

  delete(path?: string): string {
    if (!path) {
      return "Error: Path is required for delete command";
    }
    const normalizedPath = this.normalizePath(path);
    if (!this.files.has(normalizedPath)) {
      return `Error: File not found: ${path}`;
    }
    this.files.delete(normalizedPath);
    return `Successfully deleted: ${path}`;
  }

  rename(oldPath?: string, newPath?: string): string {
    if (!oldPath || !newPath) {
      return "Error: Both old_path and new_path are required for rename command";
    }
    const normalizedOldPath = this.normalizePath(oldPath);
    const normalizedNewPath = this.normalizePath(newPath);
    const content = this.files.get(normalizedOldPath);
    if (content === undefined) {
      return `Error: File not found: ${oldPath}`;
    }
    if (this.files.has(normalizedNewPath)) {
      return `Error: Destination already exists: ${newPath}`;
    }
    this.files.delete(normalizedOldPath);
    this.files.set(normalizedNewPath, content);
    return `Successfully renamed ${oldPath} to ${newPath}`;
  }

  /** Check if any file contains the given text */
  hasFileContaining(text: string): boolean {
    for (const content of this.files.values()) {
      if (content.includes(text)) {
        return true;
      }
    }
    return false;
  }

  /** Check if any file with the given name fragment exists */
  hasFileNamed(nameFragment: string): boolean {
    for (const path of this.files.keys()) {
      if (path.includes(nameFragment)) {
        return true;
      }
    }
    return false;
  }

  /** Get all file contents for debugging */
  getAllFiles(): Record<string, string> {
    return Object.fromEntries(this.files);
  }

  executeCommand(command: Memory20250818Command): string {
    switch (command.command) {
      case "view":
        return this.view(command.path);
      case "create":
        return this.create(command.path, command.file_text);
      case "str_replace":
        return this.strReplace(command.path, command.old_str, command.new_str);
      case "insert":
        return this.insert(
          command.path,
          command.insert_line,
          command.insert_text
        );
      case "delete":
        return this.delete(command.path);
      case "rename":
        return this.rename(command.old_path, command.new_path);
      default:
        return `Error: Unknown command: ${JSON.stringify(command)}`;
    }
  }
}

const createModel = () =>
  new ChatAnthropic({
    model: "claude-sonnet-4-5-20250929",
  });

describe("Anthropic Memory Tool Integration Tests", () => {
  test("memory_20250818 creates a valid tool with correct providerToolDefinition", () => {
    const memoryFs = new MockMemoryFileSystem();
    const memory = memory_20250818({
      execute: async (action) => memoryFs.executeCommand(action),
    });

    expect(memory.name).toBe("memory");
    expect(memory.extras?.providerToolDefinition).toEqual({
      type: "memory_20250818",
      name: "memory",
    });
  });

  test("memory tool can be bound to ChatAnthropic and triggers tool call", async () => {
    const memoryFs = new MockMemoryFileSystem();
    const memory = memory_20250818({
      execute: async (action) => memoryFs.executeCommand(action),
    });

    const llm = createModel();
    const llmWithMemory = llm.bindTools([memory]);

    const response = await llmWithMemory.invoke(
      "Please remember that my favorite programming language is TypeScript. Store this in a file called preferences.md"
    );

    expect(response).toBeInstanceOf(AIMessage);
    expect(response.tool_calls).toBeDefined();
    expect(response.tool_calls?.length).toBeGreaterThan(0);
    expect(response.tool_calls?.[0].name).toBe("memory");
  });

  test("memory tool can be used with native Anthropic tool definition", async () => {
    const llm = createModel();
    const llmWithMemory = llm.bindTools([
      { type: "memory_20250818", name: "memory" },
    ]);

    const response = await llmWithMemory.invoke("What do you know about me?");

    expect(response).toBeInstanceOf(AIMessage);
    expect(response.tool_calls).toBeDefined();
    expect(response.tool_calls?.[0].name).toBe("memory");
  });

  test("agentic loop with memory tool - create and view", async () => {
    const memoryFs = new MockMemoryFileSystem();
    const memory = memory_20250818({
      execute: async (action) => memoryFs.executeCommand(action),
    });

    const llm = createModel();
    const llmWithMemory = llm.bindTools([memory]);
    const messages: (HumanMessage | AIMessage | ToolMessage)[] = [];

    // Step 1: Ask to remember something
    const userMessage = new HumanMessage(
      "Please remember that I like Python and JavaScript. Store this in a file called languages.txt"
    );
    messages.push(userMessage);

    let response = await llmWithMemory.invoke(messages);
    messages.push(response);

    // Process tool calls until the model stops calling tools
    while (response.tool_calls && response.tool_calls.length > 0) {
      for (const toolCall of response.tool_calls) {
        if (toolCall.name === "memory") {
          const result = memoryFs.executeCommand(
            toolCall.args as Memory20250818Command
          );
          messages.push(
            new ToolMessage({
              tool_call_id: toolCall.id ?? "",
              content: result,
            })
          );
        }
      }

      response = await llmWithMemory.invoke(messages);
      messages.push(response);
    }

    // Step 2: Ask to recall
    const recallMessage = new HumanMessage(
      "What programming languages did I say I like? Check your memory."
    );
    messages.push(recallMessage);

    response = await llmWithMemory.invoke(messages);
    messages.push(response);

    // Process any tool calls for recall
    while (response.tool_calls && response.tool_calls.length > 0) {
      for (const toolCall of response.tool_calls) {
        if (toolCall.name === "memory") {
          const result = memoryFs.executeCommand(
            toolCall.args as Memory20250818Command
          );
          messages.push(
            new ToolMessage({
              tool_call_id: toolCall.id ?? "",
              content: result,
            })
          );
        }
      }

      response = await llmWithMemory.invoke(messages);
      messages.push(response);
    }

    // The final response should mention Python and/or JavaScript
    const finalContent =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    expect(
      finalContent.toLowerCase().includes("python") ||
        finalContent.toLowerCase().includes("javascript")
    ).toBe(true);
  });

  test("memory tool streaming works correctly", async () => {
    const memoryFs = new MockMemoryFileSystem();
    const memory = memory_20250818({
      execute: async (action) => memoryFs.executeCommand(action),
    });

    const llm = createModel();
    const llmWithMemory = llm.bindTools([memory]);

    const stream = await llmWithMemory.stream(
      "Remember that my name is Alice. Save this to user_info.txt"
    );

    let finalChunk: AIMessageChunk | undefined;
    for await (const chunk of stream) {
      if (!finalChunk) {
        finalChunk = chunk;
      } else {
        finalChunk = concat(finalChunk, chunk);
      }
    }

    expect(finalChunk).toBeDefined();
    expect(finalChunk).toBeInstanceOf(AIMessageChunk);
    expect(finalChunk?.tool_calls?.length).toBeGreaterThan(0);
    expect(finalChunk?.tool_calls?.[0].name).toBe("memory");
  });

  test("memory tool with str_replace command", async () => {
    const memoryFs = new MockMemoryFileSystem();
    // Pre-populate with a file (use normalized path without leading slash)
    memoryFs.create("notes.txt", "My favorite color is blue.");

    const memory = memory_20250818({
      execute: async (action) => memoryFs.executeCommand(action),
    });

    const llm = createModel();
    const llmWithMemory = llm.bindTools([memory]);
    const messages: (HumanMessage | AIMessage | ToolMessage)[] = [];

    // First, tell the model about the existing file by having it view the directory
    const setupMessage = new HumanMessage(
      "First, view the root directory to see what files exist in memory."
    );
    messages.push(setupMessage);

    let response = await llmWithMemory.invoke(messages);
    messages.push(response);

    // Process tool calls for viewing
    while (response.tool_calls && response.tool_calls.length > 0) {
      for (const toolCall of response.tool_calls) {
        if (toolCall.name === "memory") {
          const result = memoryFs.executeCommand(
            toolCall.args as Memory20250818Command
          );
          messages.push(
            new ToolMessage({
              tool_call_id: toolCall.id ?? "",
              content: result,
            })
          );
        }
      }

      response = await llmWithMemory.invoke(messages);
      messages.push(response);
    }

    // Now ask to update the file
    const userMessage = new HumanMessage(
      "I changed my mind, my favorite color is now green. Please update the notes.txt file to reflect this change by replacing 'blue' with 'green'."
    );
    messages.push(userMessage);

    response = await llmWithMemory.invoke(messages);
    messages.push(response);

    // Process tool calls for str_replace
    while (response.tool_calls && response.tool_calls.length > 0) {
      for (const toolCall of response.tool_calls) {
        if (toolCall.name === "memory") {
          const result = memoryFs.executeCommand(
            toolCall.args as Memory20250818Command
          );
          messages.push(
            new ToolMessage({
              tool_call_id: toolCall.id ?? "",
              content: result,
            })
          );
        }
      }

      response = await llmWithMemory.invoke(messages);
      messages.push(response);
    }

    // Verify the file was updated - check using normalized path
    expect(memoryFs.hasFileContaining("green")).toBe(true);
    expect(memoryFs.hasFileContaining("blue")).toBe(false);
  });

  test("memory tool with delete command", async () => {
    const memoryFs = new MockMemoryFileSystem();
    // Pre-populate with a file (use normalized path without leading slash)
    memoryFs.create("temp.txt", "Temporary content");

    const memory = memory_20250818({
      execute: async (action) => memoryFs.executeCommand(action),
    });

    const llm = createModel();
    const llmWithMemory = llm.bindTools([memory]);
    const messages: (HumanMessage | AIMessage | ToolMessage)[] = [];

    // First, tell the model about the existing file by having it view the directory
    const setupMessage = new HumanMessage(
      "First, view the root directory to see what files exist in memory."
    );
    messages.push(setupMessage);

    let response = await llmWithMemory.invoke(messages);
    messages.push(response);

    // Process tool calls for viewing
    while (response.tool_calls && response.tool_calls.length > 0) {
      for (const toolCall of response.tool_calls) {
        if (toolCall.name === "memory") {
          const result = memoryFs.executeCommand(
            toolCall.args as Memory20250818Command
          );
          messages.push(
            new ToolMessage({
              tool_call_id: toolCall.id ?? "",
              content: result,
            })
          );
        }
      }

      response = await llmWithMemory.invoke(messages);
      messages.push(response);
    }

    // Now ask to delete the file
    const userMessage = new HumanMessage(
      "Please delete the file called temp.txt from memory."
    );
    messages.push(userMessage);

    response = await llmWithMemory.invoke(messages);
    messages.push(response);

    // Process tool calls for delete
    while (response.tool_calls && response.tool_calls.length > 0) {
      for (const toolCall of response.tool_calls) {
        if (toolCall.name === "memory") {
          const result = memoryFs.executeCommand(
            toolCall.args as Memory20250818Command
          );
          messages.push(
            new ToolMessage({
              tool_call_id: toolCall.id ?? "",
              content: result,
            })
          );
        }
      }

      response = await llmWithMemory.invoke(messages);
      messages.push(response);
    }

    // Verify the file was deleted - check that no file with "temp" exists
    expect(memoryFs.hasFileNamed("temp")).toBe(false);
  });
});
