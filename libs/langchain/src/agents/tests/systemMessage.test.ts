import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  type MockInstance,
} from "vitest";
import {
  HumanMessage,
  BaseMessage,
  SystemMessage,
  AIMessage,
} from "@langchain/core/messages";
import { FakeToolCallingChatModel } from "./utils.js";

import { createAgent, createMiddleware } from "../index.js";

vi.mock(
  "@langchain/anthropic",
  () => import("../middleware/tests/__mocks__/@langchain/anthropic.js")
);

describe("systemMessage", () => {
  let model: FakeToolCallingChatModel;
  let invokeSpy: MockInstance;
  beforeEach(() => {
    model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Mocked response")],
    });
    invokeSpy = vi.spyOn(model, "invoke");
  });

  it("should allow to set nothing as system message", async () => {
    const agent = createAgent({ model });
    await agent.invoke({ messages: "Hello World!" });
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const payload = invokeSpy.mock.calls[0][0] as BaseMessage[];
    expect(payload).toHaveLength(1);
    expect(HumanMessage.isInstance(payload[0])).toBe(true);
  });

  it("should allow to set a system message as string", async () => {
    const agent = createAgent({
      model,
      systemPrompt: "You are a helpful assistant.",
    });
    await agent.invoke({ messages: "Hello World!" });
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const payload = invokeSpy.mock.calls[0][0] as BaseMessage[];
    expect(payload).toHaveLength(2);
    expect(SystemMessage.isInstance(payload[0])).toBe(true);
    expect(HumanMessage.isInstance(payload[1])).toBe(true);
  });

  it("should allow to set a system message as SystemMessage object", async () => {
    const agent = createAgent({
      model,
      systemPrompt: new SystemMessage("You are a helpful assistant."),
    });
    await agent.invoke({ messages: "Hello World!" });
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const payload = invokeSpy.mock.calls[0][0] as BaseMessage[];
    expect(payload).toHaveLength(2);
    expect(SystemMessage.isInstance(payload[0])).toBe(true);
    expect(HumanMessage.isInstance(payload[1])).toBe(true);
  });

  it("should allow set system message as string in wrapModelCall", async () => {
    const middleware = createMiddleware({
      name: "TestMiddleware",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemPrompt: "You are a helpful assistant.",
        });
      },
    });
    const agent = createAgent({ model, middleware: [middleware] });
    await agent.invoke({ messages: "Hello World!" });
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const payload = invokeSpy.mock.calls[0][0] as BaseMessage[];
    expect(payload).toHaveLength(2);
    expect(SystemMessage.isInstance(payload[0])).toBe(true);
    expect(HumanMessage.isInstance(payload[1])).toBe(true);
    expect(payload[0].text).toBe("You are a helpful assistant.");
  });

  it("should allow set system message as SystemMessage object in wrapModelCall", async () => {
    const middleware = createMiddleware({
      name: "TestMiddleware",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemMessage: new SystemMessage("You are a helpful assistant."),
        });
      },
    });
    const agent = createAgent({ model, middleware: [middleware] });
    await agent.invoke({ messages: "Hello World!" });
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const payload = invokeSpy.mock.calls[0][0] as BaseMessage[];
    expect(payload).toHaveLength(2);
    expect(SystemMessage.isInstance(payload[0])).toBe(true);
    expect(HumanMessage.isInstance(payload[1])).toBe(true);
    expect(payload[0].text).toBe("You are a helpful assistant.");
  });

  it("should allow to update system prompt in wrapModelCall", async () => {
    const middleware = createMiddleware({
      name: "TestMiddleware",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemPrompt: `${request.systemPrompt} I know!`,
        });
      },
    });
    const agent = createAgent({
      model,
      systemPrompt: "You are a helpful assistant.",
      middleware: [middleware],
    });
    await agent.invoke({ messages: "Hello World!" });
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const payload = invokeSpy.mock.calls[0][0] as BaseMessage[];
    expect(payload).toHaveLength(2);
    expect(SystemMessage.isInstance(payload[0])).toBe(true);
    expect(HumanMessage.isInstance(payload[1])).toBe(true);
    expect(payload[0].text).toBe("You are a helpful assistant. I know!");
    expect(payload[0].content).toEqual([
      { type: "text", text: "You are a helpful assistant. I know!" },
    ]);
  });

  it("should allow to update system message in wrapModelCall", async () => {
    const middleware = createMiddleware({
      name: "TestMiddleware",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemMessage: request.systemMessage.concat(" I know!"),
        });
      },
    });
    const agent = createAgent({
      model,
      systemPrompt: "You are a helpful assistant.",
      middleware: [middleware],
    });
    await agent.invoke({ messages: "Hello World!" });
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const payload = invokeSpy.mock.calls[0][0] as BaseMessage[];
    expect(payload).toHaveLength(2);
    expect(SystemMessage.isInstance(payload[0])).toBe(true);
    expect(HumanMessage.isInstance(payload[1])).toBe(true);
    expect(payload[0].text).toBe("You are a helpful assistant. I know!");
    expect(payload[0].content).toEqual([
      { type: "text", text: "You are a helpful assistant." },
      { type: "text", text: " I know!" },
    ]);
  });

  it("should not allow to set system message AND system prompt in wrapModelCall", async () => {
    const middleware = createMiddleware({
      name: "TestMiddleware",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemPrompt: "You are a helpful assistant.",
          systemMessage: new SystemMessage("You are a helpful assistant."),
        });
      },
    });
    const agent = createAgent({ model, middleware: [middleware] });
    await expect(agent.invoke({ messages: "Hello World!" })).rejects.toThrow(
      "Cannot change both systemPrompt and systemMessage in the same request."
    );
  });

  it("should not allow to update system message AND update system prompt in wrapModelCall", async () => {
    const middleware = createMiddleware({
      name: "TestMiddleware",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemPrompt: `${request.systemPrompt} I know!`,
          systemMessage: request.systemMessage.concat(" I don't know!"),
        });
      },
    });
    const agent = createAgent({
      model,
      systemPrompt: "You are a helpful assistant.",
      middleware: [middleware],
    });
    await expect(agent.invoke({ messages: "Hello World!" })).rejects.toThrow(
      "Cannot change both systemPrompt and systemMessage in the same request."
    );
  });

  it("should allow to set cache control in wrapModelCall", async () => {
    const middleware = createMiddleware({
      name: "TestMiddleware",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemMessage: request.systemMessage.concat(
            new SystemMessage({
              content: [
                {
                  type: "text",
                  text: "I am cached",
                  cache_control: { type: "ephemeral", ttl: "5m" },
                },
              ],
            })
          ),
        });
      },
    });
    const agent = createAgent({
      model,
      systemPrompt: "You are a helpful assistant.",
      middleware: [middleware],
    });
    await agent.invoke({ messages: "Hello World!" });
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const payload = invokeSpy.mock.calls[0][0] as BaseMessage[];
    expect(payload).toHaveLength(2);
    expect(SystemMessage.isInstance(payload[0])).toBe(true);
    expect(HumanMessage.isInstance(payload[1])).toBe(true);
    expect(payload[0].text).toBe("You are a helpful assistant.I am cached");
    expect(payload[0].content).toEqual([
      { type: "text", text: "You are a helpful assistant." },
      {
        type: "text",
        text: "I am cached",
        cache_control: { type: "ephemeral", ttl: "5m" },
      },
    ]);
  });

  it("should allow to set cache control in wrapModelCall with existing system message", async () => {
    const middleware = createMiddleware({
      name: "TestMiddleware",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemMessage: request.systemMessage.concat(
            new SystemMessage({
              content: [
                {
                  type: "text",
                  text: "I am also cached",
                  cache_control: { type: "ephemeral", ttl: "5m" },
                },
              ],
            })
          ),
        });
      },
    });
    const agent = createAgent({
      model,
      systemPrompt: new SystemMessage({
        content: [
          {
            type: "text",
            text: "You are a helpful assistant.",
            cache_control: { type: "ephemeral", ttl: "1m" },
          },
        ],
      }),
      middleware: [middleware],
    });
    await agent.invoke({ messages: "Hello World!" });
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const payload = invokeSpy.mock.calls[0][0] as BaseMessage[];
    expect(payload).toHaveLength(2);
    expect(SystemMessage.isInstance(payload[0])).toBe(true);
    expect(HumanMessage.isInstance(payload[1])).toBe(true);
    expect(payload[0].text).toBe(
      "You are a helpful assistant.I am also cached"
    );
    expect(payload[0].content).toEqual([
      {
        type: "text",
        text: "You are a helpful assistant.",
        cache_control: { type: "ephemeral", ttl: "1m" },
      },
      {
        type: "text",
        text: "I am also cached",
        cache_control: { type: "ephemeral", ttl: "5m" },
      },
    ]);
  });

  it("allows updates of system message in by multiple middleware", async () => {
    const middleware1 = createMiddleware({
      name: "TestMiddleware1",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemMessage: request.systemMessage.concat(" I know!"),
        });
      },
    });
    const middleware2 = createMiddleware({
      name: "TestMiddleware2",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemPrompt: `${request.systemPrompt} I don't know!`,
        });
      },
    });
    const middleware3 = createMiddleware({
      name: "TestMiddleware3",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemMessage: request.systemMessage.concat(" Oh no, I know!"),
        });
      },
    });
    const agent = createAgent({
      model,
      systemPrompt: "You are a helpful assistant.",
      middleware: [middleware1, middleware2, middleware3],
    });
    await agent.invoke({ messages: "Hello World!" });
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const payload = invokeSpy.mock.calls[0][0] as BaseMessage[];
    expect(payload).toHaveLength(2);
    expect(SystemMessage.isInstance(payload[0])).toBe(true);
    expect(HumanMessage.isInstance(payload[1])).toBe(true);
    expect(payload[0].text).toBe(
      "You are a helpful assistant. I know! I don't know! Oh no, I know!"
    );
    expect(payload[0].content).toEqual([
      {
        type: "text",
        text: "You are a helpful assistant. I know! I don't know!",
      },
      { type: "text", text: " Oh no, I know!" },
    ]);
  });

  it("will overwrite cache control if middleware update system prompt", async () => {
    const middleware1 = createMiddleware({
      name: "TestMiddleware1",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemPrompt: `${request.systemPrompt} I know!`,
        });
      },
    });
    const agent = createAgent({
      model,
      systemPrompt: new SystemMessage({
        content: [
          {
            type: "text",
            text: "You are a helpful assistant.",
            cache_control: { type: "ephemeral", ttl: "1m" },
          },
        ],
      }),
      middleware: [middleware1],
    });
    await agent.invoke({ messages: "Hello World!" });
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const payload = invokeSpy.mock.calls[0][0] as BaseMessage[];
    expect(payload).toHaveLength(2);
    expect(SystemMessage.isInstance(payload[0])).toBe(true);
    expect(HumanMessage.isInstance(payload[1])).toBe(true);
    expect(payload[0].text).toBe("You are a helpful assistant. I know!");
    expect(payload[0].content).toEqual([
      { type: "text", text: "You are a helpful assistant. I know!" },
    ]);
  });

  it("should allow to reset system prompt in wrapModelCall", async () => {
    const middleware = createMiddleware({
      name: "TestMiddleware",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemPrompt: undefined,
        });
      },
    });
    const agent = createAgent({
      model,
      systemPrompt: "You are a helpful assistant.",
      middleware: [middleware],
    });
    await agent.invoke({ messages: "Hello World!" });
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const payload = invokeSpy.mock.calls[0][0] as BaseMessage[];
    expect(payload).toHaveLength(1);
    expect(HumanMessage.isInstance(payload[0])).toBe(true);
  });

  it("should allow to reset system message in wrapModelCall", async () => {
    const middleware = createMiddleware({
      name: "TestMiddleware",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemMessage: undefined,
        });
      },
    });
    const agent = createAgent({
      model,
      systemPrompt: "You are a helpful assistant.",
      middleware: [middleware],
    });
    await agent.invoke({ messages: "Hello World!" });
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const payload = invokeSpy.mock.calls[0][0] as BaseMessage[];
    expect(payload).toHaveLength(1);
    expect(HumanMessage.isInstance(payload[0])).toBe(true);
  });

  it("should handle middleware setting systemMessage to empty SystemMessage", async () => {
    const middleware = createMiddleware({
      name: "TestMiddleware",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemMessage: new SystemMessage(""),
        });
      },
    });
    const agent = createAgent({
      model,
      systemPrompt: "You are a helpful assistant.",
      middleware: [middleware],
    });
    await agent.invoke({ messages: "Hello World!" });
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const payload = invokeSpy.mock.calls[0][0] as BaseMessage[];
    expect(payload).toHaveLength(1);
    expect(HumanMessage.isInstance(payload[0])).toBe(true);
  });

  it("should handle middleware concatenating empty string", async () => {
    const middleware = createMiddleware({
      name: "TestMiddleware",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemMessage: request.systemMessage.concat(""),
        });
      },
    });
    const agent = createAgent({
      model,
      systemPrompt: "You are a helpful assistant.",
      middleware: [middleware],
    });
    await agent.invoke({ messages: "Hello World!" });
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const payload = invokeSpy.mock.calls[0][0] as BaseMessage[];
    expect(payload).toHaveLength(2);
    expect(SystemMessage.isInstance(payload[0])).toBe(true);
    expect(HumanMessage.isInstance(payload[1])).toBe(true);
    expect(payload[0].text).toBe("You are a helpful assistant.");
    expect(payload[0].content).toEqual([
      { type: "text", text: "You are a helpful assistant." },
    ]);
  });

  it("should handle SystemMessage with multiple content blocks", async () => {
    const middleware = createMiddleware({
      name: "TestMiddleware",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemMessage: request.systemMessage.concat(
            new SystemMessage({
              content: [
                { type: "text", text: "Fourth block" },
                { type: "text", text: "Fifth block" },
              ],
            })
          ),
        });
      },
    });
    const agent = createAgent({
      model,
      middleware: [middleware],
      systemPrompt: new SystemMessage({
        content: [
          { type: "text", text: "First block" },
          { type: "text", text: "Second block" },
          { type: "text", text: "Third block" },
        ],
      }),
    });
    await agent.invoke({ messages: "Hello World!" });
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const payload = invokeSpy.mock.calls[0][0] as BaseMessage[];
    expect(payload[0].content).toEqual([
      { type: "text", text: "First block" },
      { type: "text", text: "Second block" },
      { type: "text", text: "Third block" },
      { type: "text", text: "Fourth block" },
      { type: "text", text: "Fifth block" },
    ]);
  });

  it("should allow one middleware to set systemPrompt and next to set systemMessage", async () => {
    const middleware1 = createMiddleware({
      name: "TestMiddleware1",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemPrompt: "First",
        });
      },
    });
    const middleware2 = createMiddleware({
      name: "TestMiddleware2",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemMessage: request.systemMessage.concat(" Second"),
        });
      },
    });
    const agent = createAgent({
      model,
      middleware: [middleware1, middleware2],
    });
    await agent.invoke({ messages: "Hello World!" });
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const payload = invokeSpy.mock.calls[0][0] as BaseMessage[];
    expect(payload).toHaveLength(2);
    expect(SystemMessage.isInstance(payload[0])).toBe(true);
    expect(HumanMessage.isInstance(payload[1])).toBe(true);
    expect(payload[0].text).toBe("First Second");
    expect(payload[0].content).toEqual([
      { type: "text", text: "First" },
      { type: "text", text: " Second" },
    ]);
  });

  it("should handle SystemMessage with additional_kwargs", async () => {
    const agent = createAgent({
      model,
      systemPrompt: new SystemMessage({
        content: "Test",
        additional_kwargs: { custom: "value" },
      }),
    });
    await agent.invoke({ messages: "Hello World!" });
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const payload = invokeSpy.mock.calls[0][0] as BaseMessage[];
    expect(payload[0].additional_kwargs).toEqual({ custom: "value" });
  });

  it("should handle SystemMessage with additional_kwargs in middleware", async () => {
    const middleware = createMiddleware({
      name: "TestMiddleware",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemMessage: request.systemMessage.concat(
            new SystemMessage({
              additional_kwargs: { another: "value" },
              content: [
                { type: "text", text: "Fourth block" },
                { type: "text", text: "Fifth block" },
              ],
            })
          ),
        });
      },
    });
    const agent = createAgent({
      model,
      middleware: [middleware],
      systemPrompt: new SystemMessage({
        content: "Test",
        additional_kwargs: { custom: "value" },
      }),
    });
    await agent.invoke({ messages: "Hello World!" });
    const payload = invokeSpy.mock.calls[0][0] as BaseMessage[];
    expect(payload).toHaveLength(2);
    expect(SystemMessage.isInstance(payload[0])).toBe(true);
    expect(HumanMessage.isInstance(payload[1])).toBe(true);
    expect(payload[0].additional_kwargs).toEqual({
      custom: "value",
      another: "value",
    });
    expect(payload[0].content).toEqual([
      { type: "text", text: "Test" },
      { type: "text", text: "Fourth block" },
      { type: "text", text: "Fifth block" },
    ]);
  });

  it("should handle middleware chaining systemMessage.concat multiple times", async () => {
    const middleware = createMiddleware({
      name: "TestMiddleware",
      wrapModelCall: async (request, handler) => {
        return handler({
          ...request,
          systemMessage: request.systemMessage
            .concat(" First")
            .concat(" Second")
            .concat(" Third"),
        });
      },
    });
    const agent = createAgent({
      model,
      systemPrompt: "Base",
      middleware: [middleware],
    });
    await agent.invoke({ messages: "Hello World!" });
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const payload = invokeSpy.mock.calls[0][0] as BaseMessage[];
    expect(payload[0].text).toBe("Base First Second Third");
  });
});
