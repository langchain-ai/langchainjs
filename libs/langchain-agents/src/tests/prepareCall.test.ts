import { describe, it, expect } from "vitest";
import { z } from "zod";

import { HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";

import { FakeToolCallingChatModel } from "./utils.js";
import { createAgent } from "../index.js";

const getWeather = tool(
  (input: { city: string }) => {
    return `The weather in ${input.city} is sunny`;
  },
  {
    name: "get_weather",
    description: "Get the weather in a city",
    schema: z.object({
      city: z.string(),
    }),
  }
);

describe("prepareCall hook", () => {
  it("should populate proper state and runtime context", async () => {
    expect.assertions(8);

    const context = z.object({
      model: z.enum(["gpt-4o", "gpt-4o-mini"]).optional(),
    });

    const model = new FakeToolCallingChatModel({});
    const agent = createAgent({
      llm: model,
      tools: [],
      experimental_prepareCall: (state, runtime) => {
        expect(runtime).toBeDefined();
        expect(runtime.context).toBeDefined();
        expect(runtime.context?.model).toBe("gpt-4o-mini");

        expect(state.stepNumber).toBe(0);
        expect(state.toolCalls).toHaveLength(0);
        expect(state.model).toBe(model);
        expect(state.messages).toMatchObject([
          expect.objectContaining({
            content: "Hello, how are you?",
          }),
        ]);
        expect(state.state).toMatchObject({
          messages: [
            expect.objectContaining({
              content: "Hello, how are you?",
            }),
          ],
        });

        return {};
      },
      contextSchema: context,
    });

    await agent.invoke(
      {
        messages: [new HumanMessage("Hello, how are you?")],
      },
      {
        context: {
          model: "gpt-4o-mini",
        },
      }
    );
  });

  it("throws if toolChoice is used even though there are no tools", async () => {
    const model = new FakeToolCallingChatModel({});
    const agent = createAgent({
      llm: model,
      tools: [],
      experimental_prepareCall: () => {
        return {
          tools: ["get_weather"],
        };
      },
    });

    await expect(
      agent.invoke({
        messages: [new HumanMessage("Hello, how are you?")],
      })
    ).rejects.toThrow(
      /Unknown tool names were used to override tools: get_weather, available tools: none/
    );
  });

  it("throws if toolChoice references an unknown tool", async () => {
    const model = new FakeToolCallingChatModel({});
    const agent = createAgent({
      llm: model,
      tools: [getWeather],
      experimental_prepareCall: () => {
        return {
          tools: ["foobar"],
        };
      },
    });

    await expect(
      agent.invoke({
        messages: [new HumanMessage("Hello, how are you?")],
      })
    ).rejects.toThrow(
      /Unknown tool names were used to override tools: foobar, available tools: get_weather/
    );
  });
});
