/* eslint-disable no-process-env */

import { test } from "@jest/globals";
import { ChatAnthropicFunctions } from "../anthropicfunctions.js";
import { HumanMessage } from "../../schema/index.js";

test("Test ChatAnthropic", async () => {
  const weatherFunction = {
    name: "get_weather",
    description: " Get weather information.",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: " The location to get the weather",
        },
      },
      required: ["location"],
    },
  };

  const chat = new ChatAnthropicFunctions({
    // modelName: "claude-2",
    modelName: "claude-instant-v1",
  }).bind({
    functions: [weatherFunction],
  });
  const message = new HumanMessage("Hello, who are you?");
  const res = await chat.invoke([message]);
  console.log({ res });
});
