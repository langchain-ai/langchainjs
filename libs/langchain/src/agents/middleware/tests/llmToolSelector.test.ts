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
    });

    const agent = createAgent({
      model: mockModel,
      tools: [], // No tools
      middleware: [middleware],
    });

    await agent.invoke({
      messages: [new HumanMessage("Test message")],
    });

    // Should never call withStructuredOutput since no tools available
    expect(mockModel.withStructuredOutput).not.toHaveBeenCalled();
  });

  it("should successfully select valid tools within limit", async () => {
    const middleware = llmToolSelectorMiddleware({
      maxTools: 2,
    });

    // Mock successful tool selection - new format uses { tools: [...] }
    (mockModel.invoke as unknown as MockInstance)
      .mockResolvedValueOnce({
        tools: ["toolA", "toolB"],
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
    expect(boundTools.map((t: { name: string }) => t.name)).toEqual([
      "toolA",
      "toolB",
    ]);
  });

  it("should limit tools to maxTools when more are selected", async () => {
    const middleware = llmToolSelectorMiddleware({
      maxTools: 2,
    });

    // Mock selection of more tools than the limit
    (mockModel.invoke as unknown as MockInstance)
      .mockResolvedValueOnce({
        tools: ["toolA", "toolB", "toolC", "toolD", "toolE"],
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
    // Should only use first 2 tools
    expect(boundTools).toHaveLength(2);
    expect(boundTools.map((t: { name: string }) => t.name)).toEqual([
      "toolA",
      "toolB",
    ]);
  });

  it("should throw error when invalid tools are selected", async () => {
    const middleware = llmToolSelectorMiddleware({
      maxTools: 2,
    });

    // Mock selection of invalid tools
    (mockModel.invoke as unknown as MockInstance).mockResolvedValueOnce({
      tools: ["toolA", "invalidTool", "toolB"],
    });

    const agent = createAgent({
      model: mockModel,
      tools: allTools,
      middleware: [middleware],
    });

    await expect(
      agent.invoke({
        messages: [new HumanMessage("Test message")],
      })
    ).rejects.toThrow("Model selected invalid tools: invalidTool");
  });

  it("should use custom system prompt", async () => {
    const middleware = llmToolSelectorMiddleware({
      maxTools: 2,
      systemPrompt: "Custom system prompt",
    });

    // Mock successful tool selection
    (mockModel.invoke as unknown as MockInstance)
      .mockResolvedValueOnce({
        tools: ["toolA", "toolB"],
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

  it("should include maxTools instructions in system prompt when configured", async () => {
    const middleware = llmToolSelectorMiddleware({
      maxTools: 3,
    });

    // Mock successful tool selection
    (mockModel.invoke as unknown as MockInstance)
      .mockResolvedValueOnce({
        tools: ["toolA", "toolB"],
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
    expect(firstCall[0].content).toContain(
      "IMPORTANT: List the tool names in order of relevance"
    );
    expect(firstCall[0].content).toContain("only the first 3 will be used");
  });

  it("should use provided model instead of request model", async () => {
    const middlewareModel = createMockModel();
    const middleware = llmToolSelectorMiddleware({
      maxTools: 2,
      model: middlewareModel,
    });

    // Mock successful tool selection
    (middlewareModel.invoke as unknown as MockInstance).mockResolvedValueOnce({
      tools: ["toolA", "toolB"],
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
    expect(middlewareModel.invoke).toBeCalledTimes(1);
  });

  it("should always include specified tools", async () => {
    const middleware = llmToolSelectorMiddleware({
      maxTools: 2,
      alwaysInclude: ["toolE"],
    });

    // Mock selection that doesn't include toolE
    (mockModel.invoke as unknown as MockInstance)
      .mockResolvedValueOnce({
        tools: ["toolA", "toolB"],
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
    // Should have toolA, toolB (selected) + toolE (always included)
    expect(boundTools).toHaveLength(3);
    expect(boundTools.map((t: { name: string }) => t.name)).toContain("toolE");
    expect(boundTools.map((t: { name: string }) => t.name)).toContain("toolA");
    expect(boundTools.map((t: { name: string }) => t.name)).toContain("toolB");
  });

  it("should not count alwaysInclude tools against maxTools limit", async () => {
    const middleware = llmToolSelectorMiddleware({
      maxTools: 2,
      alwaysInclude: ["toolD", "toolE"],
    });

    // Mock selection of 2 tools (not including D or E)
    (mockModel.invoke as unknown as MockInstance)
      .mockResolvedValueOnce({
        tools: ["toolA", "toolB"],
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
    // Should have 4 tools total: 2 selected + 2 always included
    expect(boundTools).toHaveLength(4);
    const toolNames = boundTools.map((t: { name: string }) => t.name);
    expect(toolNames).toContain("toolA");
    expect(toolNames).toContain("toolB");
    expect(toolNames).toContain("toolD");
    expect(toolNames).toContain("toolE");
  });

  it("should throw error when alwaysInclude tool not found", async () => {
    const middleware = llmToolSelectorMiddleware({
      maxTools: 2,
      alwaysInclude: ["nonexistentTool"],
    });

    const agent = createAgent({
      model: mockModel,
      tools: allTools,
      middleware: [middleware],
    });

    await expect(
      agent.invoke({
        messages: [new HumanMessage("Test message")],
      })
    ).rejects.toThrow(
      "Tools in alwaysInclude not found in request: nonexistentTool"
    );
  });

  it("should return request unchanged when only alwaysInclude tools are available", async () => {
    const middleware = llmToolSelectorMiddleware({
      maxTools: 2,
      alwaysInclude: ["toolA", "toolB", "toolC", "toolD", "toolE"],
    });

    const agent = createAgent({
      model: mockModel,
      tools: allTools,
      middleware: [middleware],
    });

    (mockModel.invoke as unknown as MockInstance).mockResolvedValue(
      new AIMessage("Response from model")
    );

    await agent.invoke({
      messages: [new HumanMessage("Test message")],
    });

    // Should not call withStructuredOutput since no tools available for selection
    expect(mockModel.withStructuredOutput).not.toHaveBeenCalled();

    const boundTools = (mockModel.bindTools as unknown as MockInstance).mock
      .calls[0][0];
    // All tools should be bound since they're all in alwaysInclude
    expect(boundTools).toHaveLength(5);
  });

  it("should get last user message from history", async () => {
    const middleware = llmToolSelectorMiddleware({
      maxTools: 2,
    });

    // Mock successful tool selection
    (mockModel.invoke as unknown as MockInstance)
      .mockResolvedValueOnce({
        tools: ["toolA", "toolB"],
      })
      .mockResolvedValue(new AIMessage("Response from model"));

    const agent = createAgent({
      model: mockModel,
      tools: allTools,
      middleware: [middleware],
    });

    await agent.invoke({
      messages: [
        new HumanMessage("First message"),
        new AIMessage("AI response"),
        new HumanMessage("Second message"),
      ],
    });

    const firstCall = (mockModel.invoke as unknown as MockInstance).mock
      .calls[0][0];
    expect(firstCall).toHaveLength(2);
    // Should use the last (most recent) user message
    expect(firstCall[1].content).toContain("Second message");
  });
});
