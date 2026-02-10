import { describe, it, expect, vi } from "vitest";
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { FakeToolCallingChatModel } from "../../tests/utils.js";
import { AgentNode } from "../AgentNode.js";
import { createMiddleware } from "../../index.js";

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
      wrapModelCallHookMiddleware: [
        [middleware, () => ({})],
      ],
    });

    await Promise.all([
      node.invoke(
        { messages: [new HumanMessage("A")] },
        { configurable: {} }
      ),
      node.invoke(
        { messages: [new HumanMessage("B")] },
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
      wrapModelCallHookMiddleware: [
        [middleware, () => ({})],
      ],
    });

    await Promise.all([
      node.invoke(
        { messages: [new HumanMessage("X")] },
        { configurable: {} }
      ),
      node.invoke(
        { messages: [new HumanMessage("Y")] },
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
