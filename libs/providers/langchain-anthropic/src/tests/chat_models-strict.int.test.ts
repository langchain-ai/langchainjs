import { describe, expect, test } from "vitest";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatAnthropic } from "../chat_models.js";

const weatherToolSchema = z.object({
  location: z.string().describe("The city and state, e.g. San Francisco, CA"),
  units: z
    .enum(["celsius", "fahrenheit"])
    .describe("Preferred temperature units."),
});

function fakeWeather({
  location,
  units,
}: z.infer<typeof weatherToolSchema>): string {
  const celsius = 22;
  const isCelsius = units === "celsius";
  const value = isCelsius ? celsius : (celsius * 9) / 5 + 32;
  return `Weather in ${location}: ${value}°${isCelsius ? "C" : "F"}`;
}

const getWeather = tool(fakeWeather, {
  name: "get_weather",
  description: "Get the current weather in a given location.",
  schema: weatherToolSchema,
});

const strictGetWeather = tool(fakeWeather, {
  name: "get_weather",
  description: "Get the current weather in a given location.",
  schema: weatherToolSchema,
  extras: { strict: true },
});

const weatherReportSchema = z.object({
  location: z.string().describe("The city and state, e.g. San Francisco, CA"),
  temperature: z.number().describe("Numeric temperature value."),
  units: z.enum(["celsius", "fahrenheit"]).describe("Temperature units."),
  conditions: z
    .enum(["sunny", "cloudy", "rainy", "snowy"])
    .describe("Current weather conditions."),
});

const model = new ChatAnthropic({
  model: "claude-haiku-4-5-20251001",
});

function expectStrictWeatherCall(
  toolCall: { name: string; args: unknown } | undefined
): asserts toolCall is { name: string; args: unknown } {
  if (!toolCall) expect.fail("expected a tool call");
  expect(toolCall.name).toBe("get_weather");
  weatherToolSchema.parse(toolCall.args);
}

describe("ChatAnthropic strict tool calling", () => {
  test("strict via .bindTools(tools, { strict: true })", async () => {
    const modelWithTools = model.bindTools([getWeather], { strict: true });
    const response = await modelWithTools.invoke(
      "What's the weather in San Francisco in fahrenheit?"
    );
    expectStrictWeatherCall(response.tool_calls?.[0]);
  });

  test("strict via .bindTools(...).withConfig({ strict: true })", async () => {
    const modelWithTools = model
      .bindTools([getWeather])
      .withConfig({ strict: true });
    const response = await modelWithTools.invoke(
      "What's the weather in Paris in celsius?"
    );
    expectStrictWeatherCall(response.tool_calls?.[0]);
  });

  test("strict via .withConfig({ tools, strict: true })", async () => {
    const modelWithTools = model.withConfig({
      tools: [getWeather],
      strict: true,
    });
    const response = await modelWithTools.invoke(
      "What's the weather in London in celsius?"
    );
    expectStrictWeatherCall(response.tool_calls?.[0]);
  });

  test("strict via .invoke(input, { strict: true })", async () => {
    const modelWithTools = model.bindTools([getWeather]);
    const response = await modelWithTools.invoke(
      "What's the weather in Tokyo in celsius?",
      { strict: true }
    );
    expectStrictWeatherCall(response.tool_calls?.[0]);
  });

  test("strict via tool() extras.strict", async () => {
    const modelWithTools = model.bindTools([strictGetWeather]);
    const response = await modelWithTools.invoke(
      "What's the weather in Berlin in celsius?"
    );
    expectStrictWeatherCall(response.tool_calls?.[0]);
  });

  test("per-call strict=false overrides tool() extras.strict=true", async () => {
    const modelWithTools = model.bindTools([strictGetWeather], {
      strict: false,
    });
    const response = await modelWithTools.invoke(
      "What's the weather in Madrid in fahrenheit?"
    );
    expectStrictWeatherCall(response.tool_calls?.[0]);
  });

  test("strict via .withStructuredOutput(schema, { strict: true })", async () => {
    const structured = model.withStructuredOutput(weatherReportSchema, {
      method: "functionCalling",
      strict: true,
    });
    const result = await structured.invoke(
      "What's the weather in San Francisco in fahrenheit?"
    );
    weatherReportSchema.parse(result);
  });

  test("strict tool call composes with strict structured output", async () => {
    const modelWithTools = model.bindTools([getWeather], { strict: true });
    const userQuery = new HumanMessage(
      "What's the weather in San Francisco in fahrenheit?"
    );
    const toolResponse = await modelWithTools.invoke([userQuery]);
    const toolCall = toolResponse.tool_calls?.[0];
    expectStrictWeatherCall(toolCall);

    const toolOutput = await getWeather.invoke(toolCall);
    expect(toolOutput.content).toContain("San Francisco");

    const structured = model.withStructuredOutput(weatherReportSchema, {
      method: "functionCalling",
      strict: true,
    });
    const result = await structured.invoke([
      userQuery,
      toolResponse,
      toolOutput,
    ]);
    weatherReportSchema.parse(result);
  });
});
