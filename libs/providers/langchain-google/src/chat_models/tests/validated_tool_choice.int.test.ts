import { describe, expect, test } from "vitest";
import * as z from "zod";
import type { ToolChoice } from "@langchain/core/language_models/chat_models";
import { HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { ChatGoogle, GoogleRequestRecorder } from "../../index.js";

const toolChoices: ToolChoice[] = ["validated", { mode: "VALIDATED" }];
const weatherTool = tool(() => "21 degrees Celsius", {
  name: "get_weather",
  description: "Get the current weather for a city.",
  schema: z.object({ location: z.string() }),
});

function createModel(toolChoice: ToolChoice) {
  const recorder = new GoogleRequestRecorder();
  const model = new ChatGoogle({
    model: "gemini-2.5-flash-lite",
    apiKey: getEnvironmentVariable("TEST_API_KEY"),
    temperature: 0,
    callbacks: [recorder],
  }).bindTools([weatherTool], { tool_choice: toolChoice });
  return { model, recorder };
}

describe.each(toolChoices)("VALIDATED tool choice: %o", (toolChoice) => {
  test("accepts a function call with schema-conforming arguments", async () => {
    const { model, recorder } = createModel(toolChoice);
    const result = await model.invoke([
      new HumanMessage('Call get_weather with location set to "New York".'),
    ]);

    expect(recorder.request?.body?.toolConfig).toEqual({
      functionCallingConfig: { mode: "VALIDATED" },
    });
    expect(result.tool_calls).toHaveLength(1);
    expect(result.tool_calls?.[0]).toMatchObject({
      name: "get_weather",
      args: { location: "New York" },
    });
    expect(
      weatherTool.schema.safeParse(result.tool_calls?.[0]?.args).success
    ).toBe(true);
  });

  test("also permits a text response without forcing a function", async () => {
    const { model, recorder } = createModel(toolChoice);
    const result = await model.invoke([
      new HumanMessage(
        "Do not use any tools. Reply with the single word Hello."
      ),
    ]);

    expect(recorder.request?.body?.toolConfig).toEqual({
      functionCallingConfig: { mode: "VALIDATED" },
    });
    expect(result.tool_calls ?? []).toHaveLength(0);
    expect(result.text).toMatch(/hello/i);
  });
});
