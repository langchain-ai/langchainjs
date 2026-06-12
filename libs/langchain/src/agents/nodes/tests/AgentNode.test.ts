import { describe, it, expect, vi } from "vitest";
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { Command, isCommand } from "@langchain/langgraph";
import { z } from "zod/v3";
import { FakeToolCallingChatModel } from "../../tests/utils.js";
import { AgentNode } from "../AgentNode.js";
import { createMiddleware, toolStrategy } from "../../index.js";

describe("AgentNode concurrency", () => {
  it("concurrent invocations get isolated system messages via systemPrompt", async () => {
    const slowModel = new FakeToolCallingChatModel({
      responses: [new AIMessage("ok")],
      sleep: 50,
    });
    const spy = vi.spyOn(slowModel, "invoke");

    const middleware = createMiddleware({
      name: "TagMiddleware",
      wrapModelCall: async (request, handler) => {
        const userMsg = request.messages.at(-1)?.content as string;
        return handler({
          ...request,
          systemPrompt: `prompt:${userMsg}`,
        });
      },
    });

    const node = new AgentNode({
      model: slowModel,
      systemMessage: new SystemMessage("default"),
      toolClasses: [],
      shouldReturnDirect: new Set(),
      middleware: [middleware],
      wrapModelCallHookMiddleware: [[middleware, () => ({})]],
    });

    await Promise.all([
      node.invoke(
        { messages: [new HumanMessage("A")], structuredResponse: {} },
        { configurable: {} }
      ),
      node.invoke(
        { messages: [new HumanMessage("B")], structuredResponse: {} },
        { configurable: {} }
      ),
    ]);

    expect(spy).toHaveBeenCalledTimes(2);
    const systemTexts = spy.mock.calls
      .map((c) => (c[0] as BaseMessage[])[0].text)
      .sort();
    expect(systemTexts).toEqual(["prompt:A", "prompt:B"]);
  });

  it("concurrent invocations get isolated system messages via systemMessage", async () => {
    const slowModel = new FakeToolCallingChatModel({
      responses: [new AIMessage("ok")],
      sleep: 50,
    });
    const spy = vi.spyOn(slowModel, "invoke");

    const middleware = createMiddleware({
      name: "TagMiddleware",
      wrapModelCall: async (request, handler) => {
        const userMsg = request.messages.at(-1)?.content as string;
        return handler({
          ...request,
          systemMessage: new SystemMessage(`msg:${userMsg}`),
        });
      },
    });

    const node = new AgentNode({
      model: slowModel,
      systemMessage: new SystemMessage("default"),
      toolClasses: [],
      shouldReturnDirect: new Set(),
      middleware: [middleware],
      wrapModelCallHookMiddleware: [[middleware, () => ({})]],
    });

    await Promise.all([
      node.invoke(
        { messages: [new HumanMessage("X")], structuredResponse: {} },
        { configurable: {} }
      ),
      node.invoke(
        { messages: [new HumanMessage("Y")], structuredResponse: {} },
        { configurable: {} }
      ),
    ]);

    expect(spy).toHaveBeenCalledTimes(2);
    const systemTexts = spy.mock.calls
      .map((c) => (c[0] as BaseMessage[])[0].text)
      .sort();
    expect(systemTexts).toEqual(["msg:X", "msg:Y"]);
  });
});

describe("AgentNode system message reset on handler retry", () => {
  it("should not throw when outer middleware retries after inner middleware modified systemMessage", async () => {
    let handlerCallCount = 0;
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("ok")],
      sleep: 0,
    });

    const innerMiddleware = createMiddleware({
      name: "InnerMiddleware",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemMessage: request.systemMessage.concat(
            "\nExtra instructions from inner middleware"
          ),
        });
      },
    });

    const outerMiddleware = createMiddleware({
      name: "OuterMiddleware",
      wrapModelCall: async (request, handler) => {
        try {
          handlerCallCount += 1;
          return await handler(request);
        } catch {
          handlerCallCount += 1;
          return handler(request);
        }
      },
    });

    const node = new AgentNode({
      model,
      systemMessage: new SystemMessage("base prompt"),
      toolClasses: [],
      shouldReturnDirect: new Set(),
      middleware: [outerMiddleware, innerMiddleware],
      wrapModelCallHookMiddleware: [
        [outerMiddleware, () => ({})],
        [innerMiddleware, () => ({})],
      ],
    });

    let generateCalls = 0;
    const originalGenerate = model._generate.bind(model);
    vi.spyOn(model, "_generate").mockImplementation(async (...args) => {
      generateCalls += 1;
      if (generateCalls === 1) {
        throw new Error("simulated context overflow");
      }
      return originalGenerate(...args);
    });

    await expect(
      node.invoke(
        { messages: [new HumanMessage("hello")], structuredResponse: {} },
        { configurable: {} }
      )
    ).resolves.toBeDefined();

    expect(handlerCallCount).toBe(2);
  });

  it("should not throw when outer middleware retries after inner middleware modified systemPrompt", async () => {
    let handlerCallCount = 0;
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("ok")],
      sleep: 0,
    });

    const innerMiddleware = createMiddleware({
      name: "InnerMiddleware",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemPrompt: `${request.systemPrompt}\nExtra prompt from inner`,
        });
      },
    });

    const outerMiddleware = createMiddleware({
      name: "OuterMiddleware",
      wrapModelCall: async (request, handler) => {
        try {
          handlerCallCount += 1;
          return await handler(request);
        } catch {
          handlerCallCount += 1;
          return handler(request);
        }
      },
    });

    const node = new AgentNode({
      model,
      systemMessage: new SystemMessage("base prompt"),
      toolClasses: [],
      shouldReturnDirect: new Set(),
      middleware: [outerMiddleware, innerMiddleware],
      wrapModelCallHookMiddleware: [
        [outerMiddleware, () => ({})],
        [innerMiddleware, () => ({})],
      ],
    });

    let generateCalls = 0;
    const originalGenerate = model._generate.bind(model);
    vi.spyOn(model, "_generate").mockImplementation(async (...args) => {
      generateCalls += 1;
      if (generateCalls === 1) {
        throw new Error("simulated error");
      }
      return originalGenerate(...args);
    });

    await expect(
      node.invoke(
        { messages: [new HumanMessage("hello")], structuredResponse: {} },
        { configurable: {} }
      )
    ).resolves.toBeDefined();

    expect(handlerCallCount).toBe(2);
  });

  it("should preserve inner middleware system message changes on each retry", async () => {
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("ok")],
      sleep: 0,
    });
    const spy = vi.spyOn(model, "invoke");

    const innerMiddleware = createMiddleware({
      name: "InnerMiddleware",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemMessage: request.systemMessage.concat("\n[inner-addition]"),
        });
      },
    });

    let attempt = 0;
    const outerMiddleware = createMiddleware({
      name: "OuterMiddleware",
      wrapModelCall: async (request, handler) => {
        attempt += 1;
        if (attempt === 1) {
          try {
            return await handler(request);
          } catch {
            // fall through to retry
          }
        }
        return handler(request);
      },
    });

    const node = new AgentNode({
      model,
      systemMessage: new SystemMessage("base"),
      toolClasses: [],
      shouldReturnDirect: new Set(),
      middleware: [outerMiddleware, innerMiddleware],
      wrapModelCallHookMiddleware: [
        [outerMiddleware, () => ({})],
        [innerMiddleware, () => ({})],
      ],
    });

    let generateCalls = 0;
    const originalGenerate = model._generate.bind(model);
    vi.spyOn(model, "_generate").mockImplementation(async (...args) => {
      generateCalls += 1;
      if (generateCalls === 1) {
        throw new Error("first attempt fails");
      }
      return originalGenerate(...args);
    });

    await node.invoke(
      { messages: [new HumanMessage("test")], structuredResponse: {} },
      { configurable: {} }
    );

    const lastCallMessages = spy.mock.calls.at(-1)?.[0] as BaseMessage[];
    const systemText = lastCallMessages[0].text;
    expect(systemText).toContain("base");
    expect(systemText).toContain("[inner-addition]");
  });

  it("should handle three middleware layers with retry in outermost", async () => {
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("ok")],
      sleep: 0,
    });
    const spy = vi.spyOn(model, "invoke");

    const middlewareA = createMiddleware({
      name: "MiddlewareA",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemMessage: request.systemMessage.concat("\n[A]"),
        });
      },
    });

    const middlewareB = createMiddleware({
      name: "MiddlewareB",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemMessage: request.systemMessage.concat("\n[B]"),
        });
      },
    });

    let attempt = 0;
    const retryMiddleware = createMiddleware({
      name: "RetryMiddleware",
      wrapModelCall: async (request, handler) => {
        attempt += 1;
        if (attempt === 1) {
          try {
            return await handler(request);
          } catch {
            // retry
          }
        }
        return handler(request);
      },
    });

    const node = new AgentNode({
      model,
      systemMessage: new SystemMessage("root"),
      toolClasses: [],
      shouldReturnDirect: new Set(),
      middleware: [retryMiddleware, middlewareA, middlewareB],
      wrapModelCallHookMiddleware: [
        [retryMiddleware, () => ({})],
        [middlewareA, () => ({})],
        [middlewareB, () => ({})],
      ],
    });

    let generateCalls = 0;
    const originalGenerate = model._generate.bind(model);
    vi.spyOn(model, "_generate").mockImplementation(async (...args) => {
      generateCalls += 1;
      if (generateCalls === 1) {
        throw new Error("fail first");
      }
      return originalGenerate(...args);
    });

    await node.invoke(
      { messages: [new HumanMessage("go")], structuredResponse: {} },
      { configurable: {} }
    );

    const lastCallMessages = spy.mock.calls.at(-1)?.[0] as BaseMessage[];
    const systemText = lastCallMessages[0].text;
    expect(systemText).toContain("root");
    expect(systemText).toContain("[A]");
    expect(systemText).toContain("[B]");
  });

  it("should allow middleware to call handler multiple times for fallback logic", async () => {
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("ok")],
      sleep: 0,
    });
    const spy = vi.spyOn(model, "invoke");

    const innerMiddleware = createMiddleware({
      name: "InnerMiddleware",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemPrompt: `${request.systemPrompt}\n[inner]`,
        });
      },
    });

    const fallbackMiddleware = createMiddleware({
      name: "FallbackMiddleware",
      wrapModelCall: async (request, handler) => {
        try {
          return await handler(request);
        } catch {
          return handler({
            ...request,
            messages: [new HumanMessage("summarized context")],
          });
        }
      },
    });

    const node = new AgentNode({
      model,
      systemMessage: new SystemMessage("original"),
      toolClasses: [],
      shouldReturnDirect: new Set(),
      middleware: [fallbackMiddleware, innerMiddleware],
      wrapModelCallHookMiddleware: [
        [fallbackMiddleware, () => ({})],
        [innerMiddleware, () => ({})],
      ],
    });

    let generateCalls = 0;
    const originalGenerate = model._generate.bind(model);
    vi.spyOn(model, "_generate").mockImplementation(async (...args) => {
      generateCalls += 1;
      if (generateCalls === 1) {
        throw new Error("context too large");
      }
      return originalGenerate(...args);
    });

    await node.invoke(
      { messages: [new HumanMessage("long message")], structuredResponse: {} },
      { configurable: {} }
    );

    expect(spy).toHaveBeenCalledTimes(2);
    const retryMessages = spy.mock.calls[1][0] as BaseMessage[];
    expect(retryMessages[0].text).toContain("original");
    expect(retryMessages[0].text).toContain("[inner]");
    expect(retryMessages[1]).toBeInstanceOf(HumanMessage);
    expect(retryMessages[1].text).toBe("summarized context");
  });
});

describe("AgentNode Command collection through middleware", () => {
  it("should preserve structured-output retry Command through middleware", async () => {
    const format = toolStrategy(z.object({ foo: z.string() }));
    const extractToolName = format[0].name;

    const model = new FakeToolCallingChatModel({
      responses: [
        new AIMessage({
          content: "",
          tool_calls: [
            { name: extractToolName, args: { INVALID: 123 }, id: "call_1" },
          ],
        }),
      ],
    });

    const middleware = createMiddleware({
      name: "Passthrough",
      wrapModelCall: async (request, handler) => handler(request),
    });

    const node = new AgentNode<Record<string, unknown>>({
      model,
      systemMessage: new SystemMessage("test"),
      toolClasses: [],
      shouldReturnDirect: new Set(),
      middleware: [middleware],
      wrapModelCallHookMiddleware: [[middleware, () => ({})]],
      responseFormat: format,
    });

    const result = await node.invoke(
      { messages: [new HumanMessage("hi")], structuredResponse: {} },
      { configurable: {} }
    );

    const commands = result as Command[];
    expect(commands.filter(isCommand).length).toBeGreaterThanOrEqual(2);
  });

  it("should not double-collect Command returned by inner middleware", async () => {
    const retryCommand = new Command({
      update: { messages: [] },
      goto: "model_request",
    });

    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("ok")],
      sleep: 0,
    });

    const inner = createMiddleware({
      name: "CommandMiddleware",
      wrapModelCall: async (_request, handler) => {
        await handler(_request);
        return retryCommand;
      },
    });

    const outer = createMiddleware({
      name: "Outer",
      wrapModelCall: async (request, handler) => handler(request),
    });

    const node = new AgentNode({
      model,
      systemMessage: new SystemMessage("test"),
      toolClasses: [],
      shouldReturnDirect: new Set(),
      middleware: [outer, inner],
      wrapModelCallHookMiddleware: [
        [outer, () => ({})],
        [inner, () => ({})],
      ],
    });

    const result = await node.invoke(
      { messages: [new HumanMessage("hi")], structuredResponse: {} },
      { configurable: {} }
    );

    const commands = result as Command[];
    const matchingCommands = commands.filter((cmd) => cmd === retryCommand);
    expect(matchingCommands).toHaveLength(1);
  });
});
