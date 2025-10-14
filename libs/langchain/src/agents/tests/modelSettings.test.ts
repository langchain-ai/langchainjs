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

describe("modelSettings middleware support", () => {
  it("should pass modelSettings from middleware to model.bindTools", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = createMockModel() as any;
    const middleware = createMiddleware({
      name: "testMiddleware",
      wrapModelRequest: async (request, handler) => {
        return handler({
          ...request,
          modelSettings: {
            temperature: 0.5,
            max_tokens: 100,
          },
        });
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

    expect(model.bindTools).toHaveBeenCalled();
    const callArgs = (model.bindTools as unknown as MockInstance).mock.calls[0];
    const options = callArgs[1];
    expect(options).toHaveProperty("temperature", 0.5);
    expect(options).toHaveProperty("max_tokens", 100);
  });

  it("should pass headers from middleware modelSettings to model.bindTools", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = createMockModel() as any;
    const middleware = createMiddleware({
      name: "testMiddleware",
      wrapModelRequest: async (request, handler) => {
        return handler({
          ...request,
          modelSettings: {
            headers: {
              "X-Custom-Header": "middleware-value",
              "X-Middleware-Only": "middleware-only",
            },
          },
        });
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

    expect(model.bindTools).toHaveBeenCalled();
    const callArgs = (model.bindTools as unknown as MockInstance).mock.calls[0];
    const options = callArgs[1];
    expect(options.headers).toEqual({
      "X-Custom-Header": "middleware-value",
      "X-Middleware-Only": "middleware-only",
    });
  });

  it("should pass headers from middleware modelSettings to model.bindTools", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = createMockModel() as any;

    // Middleware that adds headers via modelSettings
    const middleware = createMiddleware({
      name: "testMiddleware",
      wrapModelRequest: async (request, handler) => {
        return handler({
          ...request,
          modelSettings: {
            headers: {
              "X-Middleware-Header": "from-middleware",
              "X-Custom-Header": "custom-value",
            },
          },
        });
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

    // Verify model.bindTools was called with headers in the options
    expect(model.bindTools).toHaveBeenCalled();
    const callArgs = (model.bindTools as unknown as MockInstance).mock.calls[0];
    const options = callArgs[1];

    expect(options.headers).toEqual({
      "X-Middleware-Header": "from-middleware",
      "X-Custom-Header": "custom-value",
    });
  });

  it("should handle modelSettings without headers", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = createMockModel() as any;
    const middleware = createMiddleware({
      name: "testMiddleware",
      wrapModelRequest: async (request, handler) => {
        return handler({
          ...request,
          modelSettings: {
            temperature: 0.7,
          },
        });
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

    expect(model.bindTools).toHaveBeenCalled();
    const callArgs = (model.bindTools as unknown as MockInstance).mock.calls[0];
    const options = callArgs[1];
    expect(options).toHaveProperty("temperature", 0.7);
    expect(options.headers).toBeUndefined();
  });

  it("should only add headers when modelSettings has headers", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = createMockModel() as any;
    const middleware = createMiddleware({
      name: "testMiddleware",
      wrapModelRequest: async (request, handler) => {
        return handler({
          ...request,
          modelSettings: {
            temperature: 0.8,
          },
        });
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

    expect(model.bindTools).toHaveBeenCalled();
    const callArgs = (model.bindTools as unknown as MockInstance).mock.calls[0];
    const options = callArgs[1];
    expect(options).not.toHaveProperty("headers");
  });

  it("should support multiple middleware with modelSettings", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = createMockModel() as any;
    const middleware1 = createMiddleware({
      name: "middleware1",
      wrapModelRequest: async (request, handler) => {
        return handler({
          ...request,
          modelSettings: {
            temperature: 0.5,
            headers: {
              "X-Middleware-1": "value1",
            },
          },
        });
      },
    });

    const middleware2 = createMiddleware({
      name: "middleware2",
      wrapModelRequest: async (request, handler) => {
        return handler({
          ...request,
          modelSettings: {
            max_tokens: 200,
            headers: {
              "X-Middleware-2": "value2",
            },
          },
        });
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

    expect(model.bindTools).toHaveBeenCalled();
    const callArgs = (model.bindTools as unknown as MockInstance).mock.calls[0];
    const options = callArgs[1];
    // Last middleware wins for overlapping properties
    expect(options).toHaveProperty("max_tokens", 200);
    expect(options.headers).toEqual({
      "X-Middleware-2": "value2",
    });
  });

  it("should pass modelSettings to bindTools while preserving invoke signal", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = createMockModel() as any;
    const abortController = new AbortController();
    const middleware = createMiddleware({
      name: "testMiddleware",
      wrapModelRequest: async (request, handler) => {
        return handler({
          ...request,
          modelSettings: {
            temperature: 0.5,
          },
        });
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

    // modelSettings goes to bindTools
    expect(model.bindTools).toHaveBeenCalled();
    const bindCallArgs = (model.bindTools as unknown as MockInstance).mock.calls[0];
    const bindOptions = bindCallArgs[1];
    expect(bindOptions).toHaveProperty("temperature", 0.5);

    // signal still goes to invoke
    expect(model.invoke).toHaveBeenCalled();
    const invokeCallArgs = (model.invoke as unknown as MockInstance).mock.calls[0];
    const invokeConfig = invokeCallArgs[1];
    expect(invokeConfig).toHaveProperty("signal");
  });
});
