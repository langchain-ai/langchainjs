import { z } from "zod/v3";
import { describe, it, expect } from "vitest";
import { tool, ToolRuntime } from "@langchain/core/tools";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { InMemoryStore } from "@langchain/langgraph";

import { createAgent } from "../index.js";
import { FakeToolCallingModel } from "./utils.js";

describe("tools", () => {
  it("can access state and context", async () => {
    const stateSchema = z.object({ bar: z.string().default("baz") });
    const contextSchema = z.object({ foo: z.string().default("bar") });
    const store = new InMemoryStore();

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            type: "tool_call",
            name: "test",
            args: { city: "Tokyo" },
            id: "1",
          },
        ],
      ],
    });

    const getWeather = tool(
      async (
        input,
        runtime: ToolRuntime<typeof stateSchema, typeof contextSchema>
      ) => {
        expect(runtime.state).toEqual(expect.objectContaining({ bar: "baz" }));
        expect(runtime.context).toEqual({ foo: "bar" });
        expect(runtime.toolCallId).toEqual("1");
        expect(runtime.config.recursionLimit).toEqual(25);
        expect(typeof runtime.writer).toBe("function");
        expect(runtime.store?.constructor.name).toEqual("AsyncBatchedStore");
        return `The weather in ${input.city} is sunny. The foo is ${runtime.context.foo} and the bar is ${runtime.state.bar}.`;
      },
      {
        name: "test",
        description: "test",
        schema: z.object({ city: z.string() }),
      }
    );

    const agent = createAgent({
      model,
      tools: [getWeather],
      store,
      contextSchema: z.object({ foo: z.string().default("bar") }),
      stateSchema: z.object({ bar: z.string().default("baz") }),
    });

    const result = await agent.invoke(
      {
        messages: [new HumanMessage("What is the weather in Tokyo?")],
        bar: "baz",
      },
      {
        context: { foo: "bar" },
      }
    );

    expect(ToolMessage.isInstance(result.messages.at(-1))).toBe(true);
    expect(result.messages.at(-1)?.content).toBe(
      "The weather in Tokyo is sunny. The foo is bar and the bar is baz."
    );
  });
});
