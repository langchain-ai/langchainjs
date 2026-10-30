import { expect, describe, it, vi } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { LanguageModelLike } from "@langchain/core/language_models/base";

import { MemorySaver } from "@langchain/langgraph-checkpoint";
import { interrupt } from "@langchain/langgraph";

import { createAgent, createMiddleware } from "../../index.js";
import { modelFallbackMiddleware } from "../modelFallback.js";

function createMockModel(name = "ChatAnthropic", model = "anthropic") {
  // Mock Anthropic model
  const invokeCallback = vi
    .fn()
    .mockResolvedValue(new AIMessage("Response from model"));
  return {
    getName: () => name,
    bindTools: vi.fn().mockReturnThis(),
    _streamResponseChunks: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    invoke: invokeCallback,
    lc_runnable: true,
    _modelType: model,
    _generate: vi.fn(),
    _llmType: () => model,
  } as unknown as LanguageModelLike;
}

describe("modelFallbackMiddleware", () => {
  it("should retry the model request with the new model", async () => {
    const model = createMockModel();
    model.invoke = vi.fn().mockRejectedValue(new Error("Model error"));
    const retryModel = createMockModel("ChatAnthropic", "anthropic");
    const agent = createAgent({
      model,
      tools: [],
      middleware: [modelFallbackMiddleware(retryModel)],
    });
    await agent.invoke({ messages: [new HumanMessage("Hello, world!")] });
    expect(model.invoke).toHaveBeenCalledTimes(1);
    expect(retryModel.invoke).toHaveBeenCalledTimes(1);
  });

  it("should allow to configure additional models", async () => {
    const model = createMockModel();
    model.invoke = vi
      .fn()
      .mockRejectedValueOnce(new Error("Model error"))
      .mockResolvedValueOnce(new AIMessage("Response from model"));
    const anotherFailingModel = createMockModel();
    anotherFailingModel.invoke = vi
      .fn()
      .mockRejectedValue(new Error("Model error"));
    const retryModel = createMockModel("ChatAnthropic", "anthropic");
    const agent = createAgent({
      model,
      tools: [],
      middleware: [
        modelFallbackMiddleware(
          anotherFailingModel,
          anotherFailingModel,
          anotherFailingModel,
          retryModel
        ),
      ] as const,
    });

    await agent.invoke({ messages: [new HumanMessage("Hello, world!")] });
    expect(model.invoke).toHaveBeenCalledTimes(1);
    expect(anotherFailingModel.invoke).toHaveBeenCalledTimes(3);
    expect(retryModel.invoke).toHaveBeenCalledTimes(1);
  });

  it("should throw if list is exhausted", async () => {
    const model = createMockModel();
    model.invoke = vi
      .fn()
      .mockRejectedValueOnce(new Error("Model error"))
      .mockResolvedValueOnce(new AIMessage("Response from model"));
    const anotherFailingModel = createMockModel();
    anotherFailingModel.invoke = vi
      .fn()
      .mockRejectedValue(new Error("Model error"));
    const agent = createAgent({
      model,
      tools: [],
      middleware: [
        modelFallbackMiddleware(
          anotherFailingModel,
          anotherFailingModel,
          anotherFailingModel
        ),
      ] as const,
    });

    await expect(
      agent.invoke({ messages: [new HumanMessage("Hello, world!")] })
    ).rejects.toThrow("Model error");
  });

  it("should not fall back on graph interrupts", async () => {
    const model = createMockModel();
    const fallbackModel = createMockModel("ChatAnthropic", "anthropic");
    let interruptCalls = 0;

    // inner middleware pauses for approval before the model call
    const approval = createMiddleware({
      name: "approval",
      wrapModelCall: async (request, handler) => {
        interruptCalls += 1;
        interrupt({ action: "approve" });
        return handler(request);
      },
    });

    const agent = createAgent({
      model,
      tools: [],
      middleware: [modelFallbackMiddleware(fallbackModel), approval] as const,
      checkpointer: new MemorySaver(),
    });

    const result = await agent.invoke(
      { messages: [new HumanMessage("Hello, world!")] },
      { configurable: { thread_id: "fallback-graph-interrupt" } }
    );

    expect(result.__interrupt__).toHaveLength(1);
    expect(result.__interrupt__?.[0].value).toEqual({ action: "approve" });
    expect(interruptCalls).toBe(1);
    expect(model.invoke).not.toHaveBeenCalled();
    expect(fallbackModel.invoke).not.toHaveBeenCalled();
  });

  it("should not fall back on graph interrupts raised by a fallback model", async () => {
    const model = createMockModel();
    model.invoke = vi.fn().mockRejectedValue(new Error("Model error"));
    const interruptingFallback = createMockModel();
    interruptingFallback.invoke = vi.fn().mockImplementation(() => {
      interrupt({ action: "approve" });
    });
    const lastFallback = createMockModel();

    const agent = createAgent({
      model,
      tools: [],
      middleware: [
        modelFallbackMiddleware(interruptingFallback, lastFallback),
      ] as const,
      checkpointer: new MemorySaver(),
    });

    const result = await agent.invoke(
      { messages: [new HumanMessage("Hello, world!")] },
      { configurable: { thread_id: "fallback-graph-interrupt-2" } }
    );

    expect(result.__interrupt__).toHaveLength(1);
    expect(lastFallback.invoke).not.toHaveBeenCalled();
  });
});
