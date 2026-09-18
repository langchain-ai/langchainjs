import { expect, describe, it, vi, afterEach } from "vitest";
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

describe("modelFallbackMiddleware built-in tools", () => {
  const clientTool = {
    name: "lookup",
    description: "client tool that must survive every fallback attempt",
    schema: { type: "object", properties: {} },
  };
  const openaiBuiltinTool = { type: "web_search" };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function fallbackTools(
    fallbackModelName: string,
    fallbackProvider: string
  ) {
    const primary = createMockModel("ChatOpenAI", "openai");
    const fallback = createMockModel(fallbackModelName, fallbackProvider);
    const middleware = modelFallbackMiddleware(fallback);
    const handler = vi.fn(async (req: { model: unknown }) => {
      if (req.model === primary) throw new Error("Model error");
      return new AIMessage("fallback response");
    });

    await middleware.wrapModelCall!(
      {
        model: primary,
        tools: [clientTool, openaiBuiltinTool],
        // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      handler as any
    );

    return handler.mock.calls[1][0] as unknown as {
      tools: unknown[];
    };
  }

  it("drops built-in tools the fallback provider does not define", async () => {
    const request = await fallbackTools("ChatAnthropic", "anthropic");
    expect(request.tools).toEqual([clientTool]);
  });

  it.each([
    [{ type: "web_search" }, "openai"],
    [{ type: "web_search_preview_2025_03_11" }, "openai"],
    [{ type: "apply_patch" }, "openai"],
    [{ type: "computer" }, "openai"],
    [{ type: "tool_search" }, "openai"],
    [{ type: "web_search_20250305", name: "web_search" }, "anthropic"],
    [{ type: "mcp_toolset", mcp_servers: [] }, "anthropic"],
    [{ type: "tool_search_tool_bm25" }, "anthropic"],
    [{ type: "tool_search_tool_bm25_20251119" }, "anthropic"],
    [{ google_search: {} }, "google"],
    [{ googleSearch: {}, urlContext: {} }, "google"],
    [{ mcpServers: [] }, "google"],
    [{ googleSearch: {}, functionDeclarations: [] }, "google"],
  ])("keeps %o only for its own provider (%s)", async (builtinTool, owner) => {
    const primary = createMockModel("ChatOpenAI", "openai");
    const fallback = createMockModel(
      owner === "anthropic" ? "ChatAnthropic" : "ChatGoogleGenerativeAI",
      owner
    );
    const middleware = modelFallbackMiddleware(fallback);
    const handler = vi.fn(async (req: { model: unknown }) => {
      if (req.model === primary) throw new Error("Model error");
      return new AIMessage("fallback response");
    });

    await middleware.wrapModelCall!(
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      { model: primary, tools: [clientTool, builtinTool] } as any,
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      handler as any
    );

    const fallbackRequest = handler.mock.calls[1][0] as unknown as {
      tools: unknown[];
    };
    const kept = owner === "openai" ? [clientTool] : [clientTool, builtinTool];
    // An OpenAI built-in never survives a non-OpenAI fallback; the others do
    // reach the provider that defines them.
    expect(fallbackRequest.tools).toEqual(kept);
  });

  it("drops a Gemini payload that also declares function tools", async () => {
    const primary = createMockModel("ChatGoogleGenerativeAI", "google");
    const fallback = createMockModel("ChatOpenAI", "openai");
    // Both keys are Gemini-shaped, so OpenAI cannot read either half.
    const mixedTool = { googleSearch: {}, functionDeclarations: [] };
    const middleware = modelFallbackMiddleware(fallback);
    const handler = vi.fn(async (req: { model: unknown }) => {
      if (req.model === primary) throw new Error("Model error");
      return new AIMessage("fallback response");
    });

    await middleware.wrapModelCall!(
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      { model: primary, tools: [mixedTool] } as any,
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      handler as any
    );

    const fallbackRequest = handler.mock.calls[1][0] as unknown as {
      tools: unknown[];
    };
    expect(fallbackRequest.tools).toEqual([]);
  });

  it("keeps built-in tools when the fallback is the same provider", async () => {
    const request = await fallbackTools("ChatOpenAI", "openai");
    expect(request.tools).toEqual([clientTool, openaiBuiltinTool]);
  });

  it("drops built-in tools when the fallback provider is unrecognized", async () => {
    const request = await fallbackTools("ChatFireworks", "fireworks");
    expect(request.tools).toEqual([clientTool]);
  });

  it("warns when a fallback attempt starts", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await fallbackTools("ChatAnthropic", "anthropic");
    expect(
      warn.mock.calls.some(([message]) =>
        String(message).includes("retrying with fallback model ChatAnthropic")
      )
    ).toBe(true);
  });
});
