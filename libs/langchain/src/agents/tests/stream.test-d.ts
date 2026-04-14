import { describe, it, expectTypeOf } from "vitest";
import { z } from "zod/v3";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { fakeModel } from "@langchain/core/testing";
import { StreamChannel, type StreamTransformer } from "@langchain/langgraph";

import { createAgent, createMiddleware } from "../index.js";

describe("stream_v2 types", () => {
  it("should type tool calls as a discriminated union", async () => {
    const addTool = tool(
      (input: { a: number; b: number }) => `The sum is ${input.a + input.b}`,
      {
        name: "add",
        description: "Adds two numbers",
        schema: z.object({ a: z.number(), b: z.number() }),
      }
    );

    const minusTool = tool(
      (input: { a: number; b: number }) =>
        `The difference is ${input.a - input.b}`,
      {
        name: "minus",
        description: "Subtracts two numbers",
        schema: z.object({ a: z.number(), b: z.number() }),
      }
    );

    const model = fakeModel()
      .respondWithTools([
        { name: "add", args: { a: 3, b: 4 }, id: "call_1" },
        { name: "minus", args: { a: 3, b: 4 }, id: "call_2" },
      ])
      .respond(new AIMessage("The answer is 7."));

    const agent = createAgent({ model, tools: [addTool, minusTool] });
    const run = await agent.stream_v2({
      messages: [new HumanMessage("What is 3 + 4?")],
    });

    for await (const call of run.toolCalls) {
      expectTypeOf(call.name).toEqualTypeOf<"add" | "minus">();
      expectTypeOf(call.status).toEqualTypeOf<
        Promise<"running" | "finished" | "error">
      >();
      if (call.name === "add") {
        expectTypeOf(call.input).toEqualTypeOf<{ a: number; b: number }>();
        expectTypeOf(call.output).toEqualTypeOf<Promise<string>>();
      } else if (call.name === "minus") {
        expectTypeOf(call.input).toEqualTypeOf<{ a: number; b: number }>();
        expectTypeOf(call.output).toEqualTypeOf<Promise<string>>();
      }
    }
  });

  it("should type middleware events with inferred state delta", async () => {
    const model = fakeModel().respond(new AIMessage("ok"));

    const tracker = createMiddleware({
      name: "tracker",
      stateSchema: z.object({
        trackerState: z.string().default("init"),
      }),
      beforeModel: () => ({ trackerState: "before" }),
    });

    const agent = createAgent({
      model,
      tools: [],
      middleware: [tracker],
    });

    const run = await agent.stream_v2({
      messages: [new HumanMessage("hi")],
    });

    for await (const event of run.middleware) {
      expectTypeOf(event.phase).toEqualTypeOf<
        "before_model" | "after_model" | "before_agent" | "after_agent"
      >();
      expectTypeOf(event.name).toEqualTypeOf<string>();
      expectTypeOf(event.stateDelta).toEqualTypeOf<{
        trackerState: string;
      }>();
      expectTypeOf(event.timestamp).toEqualTypeOf<number>();
    }
  });

  it("should type run.extensions from streamTransformers registered at creation time", async () => {
    const model = fakeModel().respond(new AIMessage("ok"));

    const eventCounter = (): StreamTransformer<{
      eventCount: StreamChannel<number>;
    }> => {
      const eventCount = new StreamChannel<number>("eventCount");
      return {
        init: () => ({ eventCount }),
        process() {
          return true;
        },
      };
    };

    const methodTracker = (): StreamTransformer<{
      methods: StreamChannel<string>;
    }> => {
      const methods = new StreamChannel<string>("methods");
      return {
        init: () => ({ methods }),
        process() {
          return true;
        },
      };
    };

    const agent = createAgent({
      model,
      tools: [],
      streamTransformers: [eventCounter, methodTracker],
    });

    const run = await agent.stream_v2({
      messages: [new HumanMessage("hi")],
    });

    expectTypeOf(run.extensions.eventCount).toEqualTypeOf<
      StreamChannel<number>
    >();
    expectTypeOf(run.extensions.methods).toEqualTypeOf<StreamChannel<string>>();
  });
});
