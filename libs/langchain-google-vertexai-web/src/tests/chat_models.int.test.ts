/* eslint-disable import/no-extraneous-dependencies, no-process-env */

import { z } from "zod";
import { test } from "@jest/globals";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  BaseMessageChunk,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { ChatPromptValue } from "@langchain/core/prompt_values";
import { StructuredTool } from "@langchain/core/tools";
import { ChatVertexAI } from "../chat_models.js";

const weatherToolSchema = z.object({
  locations: z
    .array(z.object({ name: z.string() }))
    .describe("The name of cities to get the weather for."),
});
type WeatherToolSchema = z.infer<typeof weatherToolSchema>;

class WeatherTool extends StructuredTool {
  schema = weatherToolSchema;

  description =
    "Get the weather of a specific location and return the temperature in Celsius.";

  name = "get_weather";

  async _call(input: WeatherToolSchema) {
    // console.log(`WeatherTool called with input: ${input}`);
    return `The weather in ${JSON.stringify(input.locations)} is 25°C`;
  }
}

describe("Google APIKey Chat", () => {
  test("invoke", async () => {
    const model = new ChatVertexAI({
      authOptions: {
        credentials: JSON.parse(
          process.env.GOOGLE_VERTEX_AI_WEB_CREDENTIALS ?? ""
        ),
      },
    });
    const res = await model.invoke("What is 1 + 1?");
    // console.log(res);
    expect(res).toBeDefined();
    expect(res._getType()).toEqual("ai");

    const aiMessage = res as AIMessageChunk;
    // console.log(aiMessage);
    expect(aiMessage.content).toBeDefined();
    expect(aiMessage.content.length).toBeGreaterThan(0);
    expect(aiMessage.content[0]).toBeDefined();
  });

  test("generate", async () => {
    const model = new ChatVertexAI();
    const messages: BaseMessage[] = [
      new SystemMessage(
        "You will reply to all requests to flip a coin with either H, indicating heads, or T, indicating tails."
      ),
      new HumanMessage("Flip it"),
      new AIMessage("T"),
      new HumanMessage("Flip the coin again"),
    ];
    const res = await model.predictMessages(messages);
    expect(res).toBeDefined();
    expect(res._getType()).toEqual("ai");

    const aiMessage = res as AIMessageChunk;
    expect(aiMessage.content).toBeDefined();
    expect(aiMessage.content.length).toBeGreaterThan(0);
    expect(aiMessage.content[0]).toBeDefined();
  });

  test("stream", async () => {
    const model = new ChatVertexAI();
    const input: BaseLanguageModelInput = new ChatPromptValue([
      new SystemMessage(
        "You will reply to all requests to flip a coin with either H, indicating heads, or T, indicating tails."
      ),
      new HumanMessage("Flip it"),
      new AIMessage("T"),
      new HumanMessage("Flip the coin again"),
    ]);
    const res = await model.stream(input);
    const resArray: BaseMessageChunk[] = [];
    for await (const chunk of res) {
      resArray.push(chunk);
    }
    expect(resArray).toBeDefined();
    expect(resArray.length).toBeGreaterThanOrEqual(1);

    const lastChunk = resArray[resArray.length - 1];
    expect(lastChunk).toBeDefined();
    expect(lastChunk._getType()).toEqual("ai");
    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    const aiChunk = lastChunk as AIMessageChunk;
    // console.log(aiChunk);

    // console.log(JSON.stringify(resArray, null, 2));
  });

  test("Tool call", async () => {
    const chat = new ChatVertexAI().bindTools([new WeatherTool()]);
    const res = await chat.invoke("What is the weather in SF and LA");
    // console.log(res);
    expect(res.tool_calls?.length).toEqual(1);
    expect(res.tool_calls?.[0].args).toEqual(
      JSON.parse(res.additional_kwargs.tool_calls?.[0].function.arguments ?? "")
    );
  });

  test("withStructuredOutput", async () => {
    const tool = {
      name: "get_weather",
      description:
        "Get the weather of a specific location and return the temperature in Celsius.",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The name of city to get the weather for.",
          },
        },
        required: ["location"],
      },
    };
    const model = new ChatVertexAI().withStructuredOutput(tool);
    const result = await model.invoke("What is the weather in Paris?");
    expect(result).toHaveProperty("location");
  });
});

describe("Google Webauth Chat", () => {
  test("invoke", async () => {
    const model = new ChatVertexAI();
    const res = await model.invoke("What is 1 + 1?");
    expect(res).toBeDefined();
    expect(res._getType()).toEqual("ai");

    const aiMessage = res as AIMessageChunk;
    expect(aiMessage.content).toBeDefined();
    expect(aiMessage.content.length).toBeGreaterThan(0);
    expect(aiMessage.content[0]).toBeDefined();
    // console.log(aiMessage);
  });

  test("generate", async () => {
    const model = new ChatVertexAI();
    const messages: BaseMessage[] = [
      new SystemMessage(
        "You will reply to all requests to flip a coin with either H, indicating heads, or T, indicating tails."
      ),
      new HumanMessage("Flip it"),
      new AIMessage("T"),
      new HumanMessage("Flip the coin again"),
    ];
    const res = await model.predictMessages(messages);
    expect(res).toBeDefined();
    expect(res._getType()).toEqual("ai");

    const aiMessage = res as AIMessageChunk;
    expect(aiMessage.content).toBeDefined();
    expect(aiMessage.content.length).toBeGreaterThan(0);
    expect(aiMessage.content[0]).toBeDefined();
    // console.log(aiMessage);
  });

  test("stream", async () => {
    const model = new ChatVertexAI();
    const input: BaseLanguageModelInput = new ChatPromptValue([
      new SystemMessage(
        "You will reply to all requests to flip a coin with either H, indicating heads, or T, indicating tails."
      ),
      new HumanMessage("Flip it"),
      new AIMessage("T"),
      new HumanMessage("Flip the coin again"),
    ]);
    const res = await model.stream(input);
    const resArray: BaseMessageChunk[] = [];
    for await (const chunk of res) {
      resArray.push(chunk);
    }
    expect(resArray).toBeDefined();
    expect(resArray.length).toBeGreaterThanOrEqual(1);

    const lastChunk = resArray[resArray.length - 1];
    expect(lastChunk).toBeDefined();
    expect(lastChunk._getType()).toEqual("ai");
    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    const aiChunk = lastChunk as AIMessageChunk;
    // console.log(aiChunk);
  });
});
