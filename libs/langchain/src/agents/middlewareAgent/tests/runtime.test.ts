import { describe, it, expect } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph-checkpoint";

import { createMiddleware, createAgent } from "../index.js";
import { FakeToolCallingModel } from "../../tests/utils.js";

describe("runtime", () => {
  it("should throw on the attempt to write to the runtime", async () => {
    const model = new FakeToolCallingModel({});
    const middleware = createMiddleware({
      name: "middleware",
      beforeModel: async (_, runtime) => {
        runtime.runModelCallCount = 123;
      },
      modifyModelRequest: async (_, __, runtime) => {
        runtime.runModelCallCount = 123;
      },
      afterModel: async (_, runtime) => {
        runtime.runModelCallCount = 123;
      },
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      middleware: [middleware] as const,
      checkpointer,
    });

    await expect(
      agent.invoke({
        messages: [new HumanMessage("What is the weather in Tokyo?")],
      })
    ).rejects.toThrow("Cannot assign to read only property");
  });
});
