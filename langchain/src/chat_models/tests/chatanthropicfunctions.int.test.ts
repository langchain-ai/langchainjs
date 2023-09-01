/* eslint-disable no-process-env */

import { test } from "@jest/globals";
import { ChatAnthropicFunctions } from "../anthropicfunctions.js";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/index.js";

test("Test ChatAnthropicFunctions call", async () => {
  const functions = [
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
    {
      name: "accounting_tool",
      description:
        "Accounting tool which can record a transaction (time , location , amount).",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "Where was the consumption made?",
          },
          time: {
            type: "string",
            description:
              "time when the transaction happened, format: 2023-02-12 10:10:12",
          },
          amount: {
            type: "number",
            description: "amount of the transaction",
          },
        },
      },
    },
    {
      name: "todo_tool",
      description:
        "Todo tool which can add todo item(location , time , content)",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "location where the todo happened",
          },
          time: {
            type: "string",
            description: "time when the todo happened",
          },
          content: {
            type: "string",
            description: "content of the todo task",
          },
        },
      },
    },
    {
      name: "google_search",
      description:
        "a search engine which have access to real-time information. only useful for when you need to answer questions about current events. input should be a search query.",
      parameters: {
        type: "object",
        properties: {
          input: {
            type: "string",
          },
        },
        additionalProperties: false,
        $schema: "http://json-schema.org/draft-07/schema#",
      },
    },
  ];

  const chat = new ChatAnthropicFunctions({
    modelName: "claude-2",
  }).bind({
    functions,
  });

  const systemPrompt = PromptTemplate.fromTemplate(
    "You are a helpful AI assistant. current date : 2023-08-31"
  );

  const chatPrompt = ChatPromptTemplate.fromPromptMessages([
    new SystemMessagePromptTemplate(systemPrompt),
    HumanMessagePromptTemplate.fromTemplate("{text}"),
  ]);
  const res = await chat.invoke(
    await chatPrompt.formatMessages({
      // text: "Hello "
      // text: "How many tesla model 3 sale in 2022",
      // text: " The personnel appointment and removal meeting will be held at 4:00 pm tomorrow.",
      text: " It cost me $10 for lunch.",
    })
  );
  console.log({ res });
  expect(res.additional_kwargs.function_call?.name).toBe("accounting_tool");
});
