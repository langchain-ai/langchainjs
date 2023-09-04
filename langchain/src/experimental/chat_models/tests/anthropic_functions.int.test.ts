/* eslint-disable no-process-env */
import { test } from "@jest/globals";
import { HumanMessage } from "../../../schema/index.js";
import { AnthropicFunctions } from "../anthropic_functions.js";

test("Test AnthropicFunctions", async () => {
  const chat = new AnthropicFunctions({ modelName: "claude-2" });
  const message = new HumanMessage("Hello!");
  const res = await chat.invoke([message]);
  console.log(JSON.stringify(res));
});

test("Test AnthropicFunctions with functions", async () => {
  const chat = new AnthropicFunctions({
    modelName: "claude-2",
    temperature: 0.1,
  }).bind({
    functions: [
      {
        name: "get_current_weather",
        description: "Get the current weather in a given location",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "The city and state, e.g. San Francisco, CA",
            },
            unit: {
              type: "string",
              enum: ["celsius", "fahrenheit"],
            },
          },
          required: ["location"],
        },
      },
    ],
  });
  const message = new HumanMessage("What is the weather in San Francisco?");
  const res = await chat.invoke([message]);
  console.log(JSON.stringify(res));
});

test("Test AnthropicFunctions with a forced function call", async () => {
  const chat = new AnthropicFunctions({
    modelName: "claude-2",
    temperature: 0.1,
  }).bind({
    functions: [
      {
        name: "extract_data",
        description: "Return information about the input",
        parameters: {
          type: "object",
          properties: {
            sentiment: {
              type: "string",
              description: "The city and state, e.g. San Francisco, CA",
            },
            aggressiveness: {
              type: "integer",
              description: "How aggressive the input is from 1 to 10",
            },
            language: {
              type: "string",
              description: "The language the input is in",
            },
          },
          required: ["sentiment", "aggressiveness"],
        },
      },
    ],
    function_call: { name: "extract_data" },
  });
  const message = new HumanMessage(
    "Extract the desired information from the following passage:\n\nthis is really cool"
  );
  const res = await chat.invoke([message]);
  console.log(JSON.stringify(res));
});
