import { describe, it, expect, vi, type MockInstance } from "vitest";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";

import { createAgent } from "../../index.js";
import { todoListMiddleware } from "../todoListMiddleware.js";
import { getHookFunction } from "../utils.js";

function createMockModel(name = "ChatAnthropic", modelType = "anthropic") {
  // Mock Chat model extending BaseChatModel
  const mockModel = {
    getName: () => name,
    bindTools: vi.fn().mockReturnThis(),
    _streamResponseChunks: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    invoke: vi.fn().mockResolvedValue(new AIMessage("Response from model")),
    lc_runnable: true,
    _modelType: modelType,
    _generate: vi.fn(),
    _llmType: () => modelType,
  } as unknown as BaseChatModel;
  mockModel.withStructuredOutput = vi.fn().mockReturnValue(mockModel);

  return mockModel;
}

describe("todoListMiddleware", () => {
  it("should add the system prompt to the model request", async () => {
    const middleware = todoListMiddleware();
    const model = createMockModel();
    const agent = createAgent({
      model,
      systemPrompt: "You are a helpful assistant.",
      middleware: [middleware],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
    });

    expect(result.todos).toEqual([]);
    const [messages] = (model.invoke as unknown as MockInstance).mock
      .calls[0][0];
    expect(messages.text).toContain(
      "You are a helpful assistant.\n\n## `write_todos`\n\nYou have "
    );
  });

  it("should add the custom system prompt to the model request and custom tool description", async () => {
    const openAIFetchMock = vi.fn().mockImplementation(async () => {
      const mockResponse = {
        id: "chatcmpl-test123",
        object: "chat.completion",
        created: Date.now(),
        model: "gpt-4o",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content:
                "I'll help you with that task. Let me create a todo list to track the work.",
              tool_calls: [
                {
                  id: "call_test123",
                  type: "function",
                  function: {
                    name: "write_todos",
                    arguments: JSON.stringify({
                      todos: [
                        {
                          content: "Complete the requested task",
                          status: "in_progress",
                        },
                      ],
                    }),
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 25,
          total_tokens: 75,
        },
      };

      // Return a proper Response object
      return new Response(JSON.stringify(mockResponse), {
        status: 200,
        statusText: "OK",
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    const middleware = todoListMiddleware({
      systemPrompt: "Custom system prompt",
      toolDescription: "Custom tool description",
    });

    const model = new ChatOpenAI({
      model: "gpt-4o",
      apiKey: "test-key", // Add required API key for testing
      configuration: {
        fetch: openAIFetchMock,
      },
      maxRetries: 0, // Disable retries for faster test execution
    });

    const agent = createAgent({
      model,
      systemPrompt: "You are a helpful assistant.",
      middleware: [middleware],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
    });

    // Verify the fetch was called
    expect(openAIFetchMock).toHaveBeenCalled();

    // Verify the request contains the expected system prompt
    const [input, init] = openAIFetchMock.mock.calls[0];
    expect(input.toString()).toContain("chat/completions");

    const requestBody = JSON.parse(init?.body as string);
    expect(requestBody.messages).toBeDefined();

    // Find the system message in the request
    const systemMessage = requestBody.messages.find(
      (msg: { role: string; content: string }) => msg.role === "system"
    );
    expect(systemMessage).toBeDefined();
    expect(systemMessage).toMatchInlineSnapshot(`
      {
        "content": [
          {
            "text": "You are a helpful assistant.",
            "type": "text",
          },
          {
            "text": "

      Custom system prompt",
            "type": "text",
          },
        ],
        "role": "system",
      }
    `);
    expect(requestBody.tools[0].function.description).toContain(
      "Custom tool description"
    );

    // Verify the result contains todos (from the middleware)
    expect(result.todos).toEqual([
      { content: "Complete the requested task", status: "in_progress" },
    ]);
  });

  describe("parallel write_todos detection", () => {
    it("should reject parallel write_todos calls with error messages", async () => {
      /**
       * Port of Python test: test_parallel_write_todos_calls_rejected
       *
       * When an AIMessage has multiple write_todos tool calls, all should be
       * rejected with error ToolMessages.
       */
      const middleware = todoListMiddleware();

      // Create an AI message with two write_todos tool calls
      const aiMessage = new AIMessage({
        content: "I'll update the todos",
        tool_calls: [
          {
            name: "write_todos",
            args: { todos: [{ content: "Task 1", status: "pending" }] },
            id: "call_1",
            type: "tool_call",
          },
          {
            name: "write_todos",
            args: { todos: [{ content: "Task 2", status: "pending" }] },
            id: "call_2",
            type: "tool_call",
          },
        ],
      });

      const state = {
        messages: [new HumanMessage("Hello"), aiMessage],
      };

      // Call afterModel hook
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fn = getHookFunction(middleware.afterModel as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await fn(state as any, {} as any);

      // Should return error messages
      expect(result).toBeDefined();
      expect(result!.messages).toHaveLength(2);
      expect(result!.messages?.[0]).toBeInstanceOf(ToolMessage);
      expect(result!.messages?.[1]).toBeInstanceOf(ToolMessage);

      const msg1 = result!.messages?.[0] as ToolMessage;
      const msg2 = result!.messages?.[1] as ToolMessage;

      expect(msg1.tool_call_id).toBe("call_1");
      expect(msg1.status).toBe("error");
      expect(msg1.content).toContain(
        "Error: The `write_todos` tool should never be called multiple times in parallel"
      );

      expect(msg2.tool_call_id).toBe("call_2");
      expect(msg2.status).toBe("error");
      expect(msg2.content).toContain(
        "Error: The `write_todos` tool should never be called multiple times in parallel"
      );
    });

    it("should reject parallel write_todos calls even when mixed with other tools", async () => {
      /**
       * Port of Python test: test_parallel_write_todos_with_other_tools
       *
       * When an AIMessage has multiple write_todos calls and other tool calls,
       * only the write_todos calls should be rejected.
       */
      const middleware = todoListMiddleware();

      // Create an AI message with two write_todos calls and one other tool call
      const aiMessage = new AIMessage({
        content: "I'll do multiple things",
        tool_calls: [
          {
            name: "some_other_tool",
            args: { param: "value" },
            id: "call_other",
            type: "tool_call",
          },
          {
            name: "write_todos",
            args: { todos: [{ content: "Task 1", status: "pending" }] },
            id: "call_1",
            type: "tool_call",
          },
          {
            name: "write_todos",
            args: { todos: [{ content: "Task 2", status: "pending" }] },
            id: "call_2",
            type: "tool_call",
          },
        ],
      });

      const state = {
        messages: [new HumanMessage("Hello"), aiMessage],
      };

      // Call afterModel hook
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fn = getHookFunction(middleware.afterModel as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await fn(state as any, {} as any);

      // Should return error messages for write_todos calls only
      expect(result).toBeDefined();
      expect(result!.messages).toHaveLength(2);

      const toolCallIds = (result!.messages as ToolMessage[]).map(
        (m) => m.tool_call_id
      );
      expect(toolCallIds).toContain("call_1");
      expect(toolCallIds).toContain("call_2");
      expect(toolCallIds).not.toContain("call_other");
    });

    it("should allow a single write_todos call", async () => {
      /**
       * Port of Python test: test_single_write_todos_call_allowed
       *
       * A single write_todos call should be allowed (return undefined).
       */
      const middleware = todoListMiddleware();

      // Create an AI message with one write_todos tool call
      const aiMessage = new AIMessage({
        content: "I'll update the todos",
        tool_calls: [
          {
            name: "write_todos",
            args: { todos: [{ content: "Task 1", status: "pending" }] },
            id: "call_1",
            type: "tool_call",
          },
        ],
      });

      const state = {
        messages: [new HumanMessage("Hello"), aiMessage],
      };

      // Call afterModel hook
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fn = getHookFunction(middleware.afterModel as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await fn(state as any, {} as any);

      // Should return undefined (no intervention needed)
      expect(result).toBeUndefined();
    });

    it("should handle empty messages gracefully", async () => {
      const middleware = todoListMiddleware();

      const state = {
        messages: [],
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fn = getHookFunction(middleware.afterModel as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await fn(state as any, {} as any);

      expect(result).toBeUndefined();
    });

    it("should handle AI message without tool calls gracefully", async () => {
      const middleware = todoListMiddleware();

      const aiMessage = new AIMessage({
        content: "Just a regular response",
      });

      const state = {
        messages: [new HumanMessage("Hello"), aiMessage],
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fn = getHookFunction(middleware.afterModel as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await fn(state as any, {} as any);

      expect(result).toBeUndefined();
    });
  });
});
