import { test } from "@jest/globals";
import { z } from "zod";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { HumanMessage } from "@langchain/core/messages";
import { ChatDeepInfra } from "../deepinfra.js";

describe("ChatDeepInfra", () => {
  test("call", async () => {
    const deepInfraChat = new ChatDeepInfra({ maxTokens: 20 });
    const message = new HumanMessage("1 + 1 = ");
    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    const res = await deepInfraChat.invoke([message]);
    // console.log({ res });
  });

  test("generate", async () => {
    const deepInfraChat = new ChatDeepInfra({ maxTokens: 20 });
    const message = new HumanMessage("1 + 1 = ");
    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    const res = await deepInfraChat.generate([[message]]);
    // console.log(JSON.stringify(res, null, 2));
  });

  test("Tool calling", async () => {
    const zodSchema = z
      .object({
        location: z
          .string()
          .describe("The name of city to get the weather for."),
      })
      .describe(
        "Get the weather of a specific location and return the temperature in Celsius."
      );
    const deepInfraChat = new ChatDeepInfra().bindTools([
      {
        type: "function",
        function: {
          name: "get_current_weather",
          description: "Get the current weather in a given location",
          parameters: toJsonSchema(zodSchema),
        },
      },
    ]);
    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    const res = await deepInfraChat.invoke(
      "What is the current weather in SF?"
    );
    // console.log({ res });
  });
});
