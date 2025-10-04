import { expect, describe, it, vi, type MockInstance } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import type { LanguageModelLike } from "@langchain/core/language_models/base";

import { createAgent, createMiddleware } from "../index.js";

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

describe("callOptions middleware support", () => {
  it("should pass callOptions from middleware to model.invoke", async () => {
    const model = createMockModel();
    const middleware = createMiddleware({
      name: "testMiddleware",
      modifyModelRequest: async (request) => {
        return {
          ...request,
          callOptions: {
            temperature: 0.5,
            max_tokens: 100,
          },
        };
      },
    });

    const agent = createAgent({
      model,
      tools: [],
      middleware: [middleware] as const,
    });

    await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
    });

    expect(model.invoke).toHaveBeenCalled();
    const callArgs = (model.invoke as unknown as MockInstance).mock.calls[0];
    const config = callArgs[1];
    expect(config).toHaveProperty("temperature", 0.5);
    expect(config).toHaveProperty("max_tokens", 100);
  });

  it("should pass headers from middleware callOptions to model.invoke", async () => {
    const model = createMockModel();
    const middleware = createMiddleware({
      name: "testMiddleware",
      modifyModelRequest: async (request) => {
        return {
          ...request,
          callOptions: {
            headers: {
              "X-Custom-Header": "middleware-value",
              "X-Middleware-Only": "middleware-only",
            },
          },
        };
      },
    });

    const agent = createAgent({
      model,
      tools: [],
      middleware: [middleware] as const,
    });

    await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
    });

    expect(model.invoke).toHaveBeenCalled();
    const callArgs = (model.invoke as unknown as MockInstance).mock.calls[0];
    const config = callArgs[1];
    expect(config.headers).toEqual({
      "X-Custom-Header": "middleware-value",
      "X-Middleware-Only": "middleware-only",
    });
  });

  it("should pass headers from middleware callOptions to model.invoke config", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = createMockModel() as any;

    // Middleware that adds headers via callOptions
    const middleware = createMiddleware({
      name: "testMiddleware",
      modifyModelRequest: async (request) => {
        return {
          ...request,
          callOptions: {
            headers: {
              "X-Middleware-Header": "from-middleware",
              "X-Custom-Header": "custom-value",
            },
          },
        };
      },
    });

    const agent = createAgent({
      model,
      tools: [],
      middleware: [middleware] as const,
    });

    await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
    });

    // Verify model.invoke was called with headers in the config
    expect(model.invoke).toHaveBeenCalled();
    const callArgs = (model.invoke as unknown as MockInstance).mock.calls[0];
    const config = callArgs[1];

    expect(config.headers).toEqual({
      "X-Middleware-Header": "from-middleware",
      "X-Custom-Header": "custom-value",
    });
  });

  it("should handle callOptions without headers", async () => {
    const model = createMockModel();
    const middleware = createMiddleware({
      name: "testMiddleware",
      modifyModelRequest: async (request) => {
        return {
          ...request,
          callOptions: {
            temperature: 0.7,
          },
        };
      },
    });

    const agent = createAgent({
      model,
      tools: [],
      middleware: [middleware] as const,
    });

    await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
    });

    expect(model.invoke).toHaveBeenCalled();
    const callArgs = (model.invoke as unknown as MockInstance).mock.calls[0];
    const config = callArgs[1];
    expect(config).toHaveProperty("temperature", 0.7);
    expect(config.headers).toBeUndefined();
  });

  it("should only add headers when either config or callOptions has headers", async () => {
    const model = createMockModel();
    const middleware = createMiddleware({
      name: "testMiddleware",
      modifyModelRequest: async (request) => {
        return {
          ...request,
          callOptions: {
            temperature: 0.8,
          },
        };
      },
    });

    const agent = createAgent({
      model,
      tools: [],
      middleware: [middleware] as const,
    });

    await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
    });

    expect(model.invoke).toHaveBeenCalled();
    const callArgs = (model.invoke as unknown as MockInstance).mock.calls[0];
    const config = callArgs[1];
    expect(config).not.toHaveProperty("headers");
  });

  it("should support multiple middleware with callOptions", async () => {
    const model = createMockModel();
    const middleware1 = createMiddleware({
      name: "middleware1",
      modifyModelRequest: async (request) => {
        return {
          ...request,
          callOptions: {
            temperature: 0.5,
            headers: {
              "X-Middleware-1": "value1",
            },
          },
        };
      },
    });

    const middleware2 = createMiddleware({
      name: "middleware2",
      modifyModelRequest: async (request) => {
        return {
          ...request,
          callOptions: {
            max_tokens: 200,
            headers: {
              "X-Middleware-2": "value2",
            },
          },
        };
      },
    });

    const agent = createAgent({
      model,
      tools: [],
      middleware: [middleware1, middleware2] as const,
    });

    await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
    });

    expect(model.invoke).toHaveBeenCalled();
    const callArgs = (model.invoke as unknown as MockInstance).mock.calls[0];
    const config = callArgs[1];
    // Last middleware wins for overlapping properties
    expect(config).toHaveProperty("max_tokens", 200);
    expect(config.headers).toEqual({
      "X-Middleware-2": "value2",
    });
  });

  it("should preserve signal from config when merging callOptions", async () => {
    const model = createMockModel();
    const abortController = new AbortController();
    const middleware = createMiddleware({
      name: "testMiddleware",
      modifyModelRequest: async (request) => {
        return {
          ...request,
          callOptions: {
            temperature: 0.5,
          },
        };
      },
    });

    const agent = createAgent({
      model,
      tools: [],
      middleware: [middleware] as const,
    });

    await agent.invoke(
      {
        messages: [new HumanMessage("Hello, world!")],
      },
      {
        signal: abortController.signal,
      }
    );

    expect(model.invoke).toHaveBeenCalled();
    const callArgs = (model.invoke as unknown as MockInstance).mock.calls[0];
    const config = callArgs[1];
    expect(config).toHaveProperty("signal");
    expect(config).toHaveProperty("temperature", 0.5);
  });
});
