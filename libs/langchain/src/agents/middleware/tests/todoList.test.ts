import { describe, it, expect, vi, type MockInstance } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";

import { createAgent } from "../../index.js";
import { todoListMiddleware } from "../todoListMiddleware.js";

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
      middleware: [middleware] as const,
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
    });

    expect(result.todos).toEqual([]);
    const [messages] = (model.invoke as unknown as MockInstance).mock
      .calls[0][0];
    expect(messages.content).toContain(
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
      middleware: [middleware] as const,
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
    expect(systemMessage.content).toContain("Custom system prompt");
    expect(requestBody.tools[0].function.description).toContain(
      "Custom tool description"
    );

    // Verify the result contains todos (from the middleware)
    expect(result.todos).toEqual([
      { content: "Complete the requested task", status: "in_progress" },
    ]);
  });
});
