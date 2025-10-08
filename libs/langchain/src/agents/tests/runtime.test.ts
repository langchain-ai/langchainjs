import { describe, it, expect } from "vitest";
import { HumanMessage } from "@langchain/core/messages";

import { createMiddleware, createAgent } from "../index.js";
import { FakeToolCallingModel } from "./utils.js";

describe("runtime", () => {
  it("should throw on the attempt to write to the runtime in beforeModel", async () => {
    const model = new FakeToolCallingModel({});
    const middleware = createMiddleware({
      name: "middleware",
      beforeModel: async (_, runtime) => {
        runtime.runModelCallCount = 123;
      },
    });

    const agent = createAgent({
      model,
      middleware: [middleware] as const,
    });

    await expect(
      agent.invoke({
        messages: [new HumanMessage("What is the weather in Tokyo?")],
      })
    ).rejects.toThrow("Cannot assign to read only property");
  });

  it("should throw on the attempt to write to the runtime in afterModel", async () => {
    const model = new FakeToolCallingModel({});
    const middleware = createMiddleware({
      name: "middleware",
      afterModel: async (_, runtime) => {
        runtime.runModelCallCount = 123;
      },
    });

    const agent = createAgent({
      model,
      middleware: [middleware] as const,
    });

    await expect(
      agent.invoke({
        messages: [new HumanMessage("What is the weather in Tokyo?")],
      })
    ).rejects.toThrow("Cannot assign to read only property");
  });

  it("should throw on the attempt to write to the runtime in modifyModelRequest", async () => {
    const model = new FakeToolCallingModel({});
    const middleware = createMiddleware({
      name: "middleware",
      modifyModelRequest: async (_, __, runtime) => {
        runtime.runModelCallCount = 123;
      },
    });

    const agent = createAgent({
      model,
      middleware: [middleware] as const,
    });

    await expect(
      agent.invoke({
        messages: [new HumanMessage("What is the weather in Tokyo?")],
      })
    ).rejects.toThrow("Cannot assign to read only property");
  });
});
