/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";
import { HumanMessage } from "@langchain/core/messages";
import { OllamaFunctions } from "../ollama_functions.js";

test.skip("Test OllamaFunctions", async () => {
  const chat = new OllamaFunctions({ model: "mistral" });
  const message = new HumanMessage("Hello!");
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chat.invoke([message]);
  // console.log(JSON.stringify(res));
});

test.skip("Test OllamaFunctions with functions", async () => {
  const chat = new OllamaFunctions({
    model: "mistral",
    temperature: 0.1,
  }).withConfig({
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
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chat.invoke([message]);
  // console.log(JSON.stringify(res));
});

test.skip("Test OllamaFunctions with a forced function call", async () => {
  const chat = new OllamaFunctions({
    model: "mistral",
    temperature: 0.1,
  }).withConfig({
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
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chat.invoke([message]);
  // console.log(JSON.stringify(res));
});
