import { describe, expect, it } from "vitest";
import { z } from "zod/v3";

import { toolStrategy, createAgent } from "../index.js";
import { toolCallLimitMiddleware } from "../middleware/toolCallLimit.js";
import { FakeToolCallingModel } from "./utils.js";

/**
 * A structured-output error is signalled by the model node returning a `Command`
 * that appends the parse error as a `ToolMessage` and retries the model. When the
 * agent also has `afterModel` middleware, the model node has a static edge into
 * the after-model chain, so the retry has to go through that chain instead of
 * racing it. See #12127.
 */

const afterModelMiddleware = () =>
  toolCallLimitMiddleware({ runLimit: 10, exitBehavior: "continue" });

describe("structured output retries with afterModel middleware", () => {
  it("retries an invalid structured output", async () => {
    const model = new FakeToolCallingModel({
      toolCalls: [
        [{ name: "extract-1", args: { foo: 42 }, id: "call_1" }],
        [{ name: "extract-1", args: { foo: "ok" }, id: "call_2" }],
      ],
    });
    const agent = createAgent({
      model,
      tools: [],
      middleware: [afterModelMiddleware()],
      responseFormat: toolStrategy(z.object({ foo: z.string() })),
    });

    const res = await agent.invoke({
      messages: [{ role: "user", content: "hi" }],
    });

    expect(res.structuredResponse).toEqual({ foo: "ok" });
  });

  it("retries multiple structured outputs", async () => {
    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          { name: "extract-2", args: { foo: "one" }, id: "call_1" },
          { name: "extract-2", args: { foo: "two" }, id: "call_2" },
        ],
        [{ name: "extract-2", args: { foo: "ok" }, id: "call_3" }],
      ],
    });
    const agent = createAgent({
      model,
      tools: [],
      middleware: [afterModelMiddleware()],
      responseFormat: toolStrategy(z.object({ foo: z.string() })),
    });

    const res = await agent.invoke({
      messages: [{ role: "user", content: "hi" }],
    });

    expect(res.structuredResponse).toEqual({ foo: "ok" });
  });

  it("still retries without afterModel middleware", async () => {
    const model = new FakeToolCallingModel({
      toolCalls: [
        [{ name: "extract-3", args: { foo: 42 }, id: "call_1" }],
        [{ name: "extract-3", args: { foo: "ok" }, id: "call_2" }],
      ],
    });
    const agent = createAgent({
      model,
      tools: [],
      responseFormat: toolStrategy(z.object({ foo: z.string() })),
    });

    const res = await agent.invoke({
      messages: [{ role: "user", content: "hi" }],
    });

    expect(res.structuredResponse).toEqual({ foo: "ok" });
  });
});
