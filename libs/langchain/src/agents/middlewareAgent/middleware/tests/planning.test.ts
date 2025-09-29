import { describe, it, expect, vi, type MockInstance } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { createAgent } from "../../index.js";
import { planningMiddleware } from "../todo.js";

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

describe("planningMiddleware", () => {
  it("should add the system prompt to the model request", async () => {
    const middleware = planningMiddleware();
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
});
