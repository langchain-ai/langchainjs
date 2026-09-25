import { describe, expect, test } from "vitest";
import { tool } from "@langchain/core/tools";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatAnthropic } from "../chat_models.js";

// Mid-conversation tool changes are only available on some models.
const model = new ChatAnthropic({ model: "claude-opus-5-5" });

describe("mid-conversation tool changes", () => {
  test("offers a deferred tool from a tool_addition reference", async () => {
    const getWeather = tool(async () => "Sunny, 22°C", {
      name: "get_weather",
      description: "Get the current weather in a given location.",
      schema: z.object({
        location: z.string().describe("The city, e.g. San Francisco"),
      }),
      extras: { defer_loading: true },
    });
    // The provider rejects a request whose tools are all deferred.
    const getTime = tool(async () => "12:00", {
      name: "get_time",
      description: "Get the current time.",
      schema: z.object({}),
    });

    const response = await model.bindTools([getTime, getWeather]).invoke([
      new HumanMessage("What's the weather in San Francisco?"),
      new SystemMessage({
        contentBlocks: [
          {
            type: "non_standard",
            value: {
              type: "tool_addition",
              tool: { type: "tool_reference", name: "get_weather" },
            },
          },
        ],
      }),
    ]);

    expect(response.tool_calls?.[0]?.name).toBe("get_weather");
  }, 120_000);

  test("offers a tool defined inline in a tool_addition", async () => {
    const response = await model.invoke([
      new HumanMessage("What time is it?"),
      new SystemMessage({
        content: [
          {
            type: "tool_addition",
            tool: {
              type: "tool_definition",
              definition: {
                name: "get_time",
                description: "Get the current time.",
                input_schema: { type: "object", properties: {} },
              },
            },
          },
        ],
      }),
    ]);

    expect(response.tool_calls?.[0]?.name).toBe("get_time");
  }, 120_000);
});
