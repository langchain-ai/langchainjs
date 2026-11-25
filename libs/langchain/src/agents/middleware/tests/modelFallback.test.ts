/* oxlint-disable @typescript-eslint/no-explicit-any */
import { expect, describe, it, vi } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { LanguageModelLike } from "@langchain/core/language_models/base";

import { Command, interrupt, MemorySaver } from "@langchain/langgraph";

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
});

describe("Graph control-flow propagation", () => {
  it("should not call fallback models when the model call interrupts", async () => {
    const checkpointer = new MemorySaver();
    const config = { configurable: { thread_id: "fallback-interrupt-thread" } };
    const primary = createMockModel();
    const fallback = createMockModel("ChatOpenAI", "openai");

    /**
     * Inner middleware interrupts the model call (e.g. an approval gate).
     * Interrupts are control flow, not failures: they must propagate
     * without triggering fallbacks.
     */
    const approval = createMiddleware({
      name: "ApprovalMiddleware",
      wrapModelCall: async (request, handler) => {
        /**
         * Gate only the primary model, so the observable failure mode is
         * the fallback model answering in place of the interrupted call.
         */
        if (request.model === (primary as unknown)) {
          interrupt({ type: "model_approval" });
        }
        return handler(request);
      },
    });

    const agent = createAgent({
      model: primary,
      tools: [],
      checkpointer,
      middleware: [modelFallbackMiddleware(fallback), approval],
    });

    const first: any = await agent.invoke(
      { messages: [new HumanMessage("hi")] },
      config
    );
    expect(first.__interrupt__).toBeDefined();
    expect(fallback.invoke).not.toHaveBeenCalled();

    const resumed: any = await agent.invoke(
      new Command({ resume: true }),
      config
    );
    expect(resumed.messages.at(-1)?.content).toBe("Response from model");
    expect(fallback.invoke).not.toHaveBeenCalled();
  });
});
