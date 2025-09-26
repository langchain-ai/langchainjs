import { z } from "zod/v3";
import {
  expect,
  describe,
  it,
  vi,
  beforeEach,
  type MockInstance,
} from "vitest";
import { tool } from "@langchain/core/tools";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

import { llmToolSelectorMiddleware } from "../llmToolSelector.js";
import { createAgent } from "../../index.js";

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

describe("llmToolSelectorMiddleware", () => {
  // Create fake tools for testing
  const toolA = tool(async () => "Tool A response", {
    name: "toolA",
    description: "Tool A for testing",
    schema: z.object({ prop: z.unknown() }),
  });

  const toolB = tool(async () => "Tool B response", {
    name: "toolB",
    description: "Tool B for testing",
    schema: z.object({ prop: z.unknown() }),
  });

  const toolC = tool(async () => "Tool C response", {
    name: "toolC",
    description: "Tool C for testing",
    schema: z.object({ prop: z.unknown() }),
  });

  const toolD = tool(async () => "Tool D response", {
    name: "toolD",
    description: "Tool D for testing",
    schema: z.object({ prop: z.unknown() }),
  });

  const toolE = tool(async () => "Tool E response", {
    name: "toolE",
    description: "Tool E for testing",
    schema: z.object({ prop: z.unknown() }),
  });

  const allTools = [toolA, toolB, toolC, toolD, toolE];

  let mockModel: BaseChatModel;

  beforeEach(() => {
    vi.clearAllMocks();
    mockModel = createMockModel();
  });

  it("should return request unchanged when no tools are available", async () => {
    const middleware = llmToolSelectorMiddleware({
      maxTools: 3,
      maxRetries: 0,
    });

    // Mock successful tool selection
    (mockModel.invoke as unknown as MockInstance)
      .mockResolvedValueOnce({
        selectedTools: [],
        messages: [new AIMessage("Response from model")],
        lc_kwargs: {},
      })
      .mockResolvedValue(new AIMessage("Response from model333"));

    const agent = createAgent({
      model: mockModel,
      tools: allTools,
      middleware: [middleware],
    });

    await agent.invoke({
      messages: [new HumanMessage("Test message")],
    });

    const boundTools = (mockModel.bindTools as unknown as MockInstance).mock
      .calls[0][0];
    expect(boundTools).toHaveLength(allTools.length);
  });

  it("should successfully select valid tools within limit", async () => {
    const middleware = llmToolSelectorMiddleware({
      maxTools: 2,
      maxRetries: 0,
    });

    // Mock successful tool selection
    (mockModel.invoke as unknown as MockInstance)
      .mockResolvedValueOnce({
        selectedTools: ["toolA", "toolB"],
        messages: [new AIMessage("Response from model")],
        lc_kwargs: {},
      })
      .mockResolvedValue(new AIMessage("Response from model"));

    const agent = createAgent({
      model: mockModel,
      tools: allTools,
      middleware: [middleware],
    });

    await agent.invoke({
      messages: [new HumanMessage("Test message")],
    });

    const boundTools = (mockModel.bindTools as unknown as MockInstance).mock
      .calls[0][0];
    expect(boundTools).toHaveLength(2);
  });

  it("should retry when too many tools are selected", async () => {
    const middleware = llmToolSelectorMiddleware({
      maxTools: 2,
      maxRetries: 2,
    });

    // Mock successful tool selection
    (mockModel.invoke as unknown as MockInstance)
      .mockResolvedValueOnce({
        selectedTools: [
          "toolA",
          "toolB",
          "toolC",
          "toolD",
          "toolE",
          "toolF",
          "toolG",
        ],
        messages: [new AIMessage("Response from model")],
        lc_kwargs: {},
      })
      .mockResolvedValueOnce({
        selectedTools: ["toolA", "toolB", "toolC", "toolD"],
        lc_kwargs: {},
      })
      .mockResolvedValueOnce({
        selectedTools: ["toolA", "toolC"],
        lc_kwargs: {},
      })
      .mockResolvedValue(new AIMessage("Response from model"));

    const agent = createAgent({
      model: mockModel,
      tools: allTools,
      middleware: [middleware],
    });

    await agent.invoke({
      messages: [new HumanMessage("Test message")],
    });

    const boundTools = (mockModel.bindTools as unknown as MockInstance).mock
      .calls[0][0];
    expect(boundTools).toHaveLength(2);
  });

  it("should retry when invalid tools are selected", async () => {
    const middleware = llmToolSelectorMiddleware({
      maxTools: 2,
      maxRetries: 2,
    });

    // Mock successful tool selection
    (mockModel.invoke as unknown as MockInstance)
      .mockResolvedValueOnce({
        selectedTools: [
          "toolA",
          "toolB",
          "toolC",
          "toolD",
          "toolE",
          "toolF",
          "toolG",
        ],
        messages: [new AIMessage("Response from model")],
        lc_kwargs: {},
      })
      .mockResolvedValueOnce({
        selectedTools: ["foobar"],
        lc_kwargs: {},
      })
      .mockResolvedValueOnce({
        selectedTools: ["toolA", "toolC"],
        lc_kwargs: {},
      })
      .mockResolvedValue(new AIMessage("Response from model"));

    const agent = createAgent({
      model: mockModel,
      tools: allTools,
      middleware: [middleware],
    });

    await agent.invoke({
      messages: [new HumanMessage("Test message")],
    });

    const boundTools = (mockModel.bindTools as unknown as MockInstance).mock
      .calls[0][0];
    expect(boundTools).toHaveLength(2);
  });

  it("should retry when no tools are selected", async () => {
    const middleware = llmToolSelectorMiddleware({
      maxTools: 2,
      maxRetries: 2,
    });

    // Mock successful tool selection
    (mockModel.invoke as unknown as MockInstance)
      .mockResolvedValueOnce({
        selectedTools: [],
        messages: [new AIMessage("Response from model")],
        lc_kwargs: {},
      })
      .mockResolvedValueOnce({
        selectedTools: [],
        lc_kwargs: {},
      })
      .mockResolvedValueOnce({
        selectedTools: ["toolA", "toolC"],
        lc_kwargs: {},
      })
      .mockResolvedValue(new AIMessage("Response from model"));

    const agent = createAgent({
      model: mockModel,
      tools: allTools,
      middleware: [middleware],
    });

    await agent.invoke({
      messages: [new HumanMessage("Test message")],
    });

    const boundTools = (mockModel.bindTools as unknown as MockInstance).mock
      .calls[0][0];
    expect(boundTools).toHaveLength(2);
  });

  it("should filter out invalid tools after max retries", async () => {
    const middleware = llmToolSelectorMiddleware({
      maxTools: 2,
      maxRetries: 2,
    });

    // Mock successful tool selection
    (mockModel.invoke as unknown as MockInstance)
      .mockResolvedValueOnce({
        selectedTools: [],
        messages: [new AIMessage("Response from model")],
        lc_kwargs: {},
      })
      .mockResolvedValueOnce({
        selectedTools: [],
        lc_kwargs: {},
      })
      .mockResolvedValueOnce({
        selectedTools: ["toolA", "foo", "bar", "toolC", "loo"],
        lc_kwargs: {},
      })
      .mockResolvedValue(new AIMessage("Response from model"));

    const agent = createAgent({
      model: mockModel,
      tools: allTools,
      middleware: [middleware],
    });

    await agent.invoke({
      messages: [new HumanMessage("Test message")],
    });

    const boundTools = (mockModel.bindTools as unknown as MockInstance).mock
      .calls[0][0] as { name: string }[];
    expect(boundTools).toHaveLength(2);
    expect(boundTools.map((tool) => tool.name)).toEqual(["toolA", "toolC"]);
  });

  it("should fall back to all tools when tool selection fails after max retries", async () => {
    const middleware = llmToolSelectorMiddleware({
      maxTools: 2,
      maxRetries: 1,
    });

    // Mock successful tool selection
    (mockModel.invoke as unknown as MockInstance)
      .mockResolvedValueOnce({
        selectedTools: [],
        messages: [new AIMessage("Response from model")],
        lc_kwargs: {},
      })
      .mockResolvedValueOnce({
        selectedTools: ["no match"],
        lc_kwargs: {},
      })
      .mockResolvedValue(new AIMessage("Response from model"));

    const agent = createAgent({
      model: mockModel,
      tools: allTools,
      middleware: [middleware],
    });

    await agent.invoke({
      messages: [new HumanMessage("Test message")],
    });

    const boundTools = (mockModel.bindTools as unknown as MockInstance).mock
      .calls[0][0] as { name: string }[];
    expect(boundTools).toHaveLength(allTools.length);
  });

  it("should use custom system prompt", async () => {
    const middleware = llmToolSelectorMiddleware({
      maxTools: 2,
      maxRetries: 1,
      systemPrompt: "Custom system prompt",
    });

    // Mock successful tool selection
    (mockModel.invoke as unknown as MockInstance)
      .mockResolvedValueOnce({
        selectedTools: [],
        messages: [new AIMessage("Response from model")],
        lc_kwargs: {},
      })
      .mockResolvedValueOnce({
        selectedTools: ["toolA", "toolB"],
        lc_kwargs: {},
      })
      .mockResolvedValue(new AIMessage("Response from model"));

    const agent = createAgent({
      model: mockModel,
      tools: allTools,
      middleware: [middleware],
    });

    await agent.invoke({
      messages: [new HumanMessage("Test message")],
    });

    const firstCall = (mockModel.invoke as unknown as MockInstance).mock
      .calls[0][0];
    expect(firstCall).toHaveLength(2);
    expect(firstCall[0].content).toContain("Custom system prompt");
    expect(firstCall[1].content).toContain("Test message");
  });

  it("should include full history when configured", async () => {
    const middleware = llmToolSelectorMiddleware({
      maxTools: 2,
      maxRetries: 1,
      includeFullHistory: true,
    });

    // Mock successful tool selection
    (mockModel.invoke as unknown as MockInstance)
      .mockResolvedValueOnce({
        selectedTools: [],
        messages: [new AIMessage("Response from model")],
        lc_kwargs: {},
      })
      .mockResolvedValueOnce({
        selectedTools: ["toolA", "toolB"],
        lc_kwargs: {},
      })
      .mockResolvedValue(new AIMessage("Response from model"));

    const agent = createAgent({
      model: mockModel,
      tools: allTools,
      middleware: [middleware],
    });

    await agent.invoke({
      messages: [new HumanMessage("Test message")],
    });

    const firstCall = (mockModel.invoke as unknown as MockInstance).mock
      .calls[0][0];
    expect(firstCall).toHaveLength(2);
    expect(firstCall[0].content).toContain("The full conversation history is");
    expect(firstCall[1].content).toContain("Test message");
  });

  it("should use provided model instead of request model", async () => {
    const middlewareModel = createMockModel();
    const middleware = llmToolSelectorMiddleware({
      maxTools: 2,
      maxRetries: 1,
      model: middlewareModel,
    });

    // Mock successful tool selection
    (middlewareModel.invoke as unknown as MockInstance)
      .mockResolvedValueOnce({
        selectedTools: [],
        messages: [new AIMessage("Response from model")],
        lc_kwargs: {},
      })
      .mockResolvedValueOnce({
        selectedTools: ["toolA", "toolB"],
        lc_kwargs: {},
      });
    (mockModel.invoke as unknown as MockInstance).mockResolvedValue(
      new AIMessage("Response from model")
    );

    const agent = createAgent({
      model: mockModel,
      tools: allTools,
      middleware: [middleware],
    });

    await agent.invoke({
      messages: [new HumanMessage("Test message")],
    });

    expect(mockModel.invoke).toBeCalledTimes(1);
    expect(middlewareModel.invoke).toBeCalledTimes(2);
  });
});
