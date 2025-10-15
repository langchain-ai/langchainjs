import { expect, describe, it, vi } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { LanguageModelLike } from "@langchain/core/language_models/base";

import { createAgent } from "../../index.js";
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
      middleware: [modelFallbackMiddleware(retryModel)] as const,
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
});
