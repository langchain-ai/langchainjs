/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";
import { HumanMessage } from "@langchain/core/messages";
import { OllamaFunctions } from "../ollama_functions.js";

test("Test OllamaFunctions", async () => {
  const chat = new OllamaFunctions({ model: "llama3:70b" });
  const message = new HumanMessage("Hello!");
  const res = await chat.invoke([message]);
  console.log(JSON.stringify(res));

  expect(res.content.length).toBeGreaterThan(1);
});

test("Test OllamaFunctions with functions", async () => {
  const chat = new OllamaFunctions({
    model: "llama3:70b",
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

  expect(res.additional_kwargs.function_call).toBeDefined();
  expect(res.additional_kwargs.function_call?.name).toBe("get_current_weather");
});

test("Test OllamaFunctions with a forced function call", async () => {
  const chat = new OllamaFunctions({
    model: "llama3:70b",
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
              description: "Whether the input is positive or negative",
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

  expect(res.additional_kwargs.function_call).toBeDefined();
  expect(res.additional_kwargs.function_call?.name).toBe("extract_data");
});
