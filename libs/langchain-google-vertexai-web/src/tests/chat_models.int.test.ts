/* eslint-disable import/no-extraneous-dependencies */

import { z } from "zod";
import { test } from "@jest/globals";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  BaseMessageChunk,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { ChatPromptValue } from "@langchain/core/prompt_values";
import { StructuredTool } from "@langchain/core/tools";
import { ChatVertexAI } from "../chat_models.js";

class WeatherTool extends StructuredTool {
  schema = z.object({
    locations: z
      .array(z.object({ name: z.string() }))
      .describe("The name of cities to get the weather for."),
  });

  description =
    "Get the weather of a specific location and return the temperature in Celsius.";

  name = "get_weather";

  async _call(input: z.infer<typeof this.schema>) {
    console.log(`WeatherTool called with input: ${input}`);
    return `The weather in ${JSON.stringify(input.locations)} is 25°C`;
  }
}

describe("Google APIKey Chat", () => {
  test("invoke", async () => {
    const model = new ChatVertexAI();
    try {
      const res = await model.invoke("What is 1 + 1?");
      console.log(res);
      expect(res).toBeDefined();
      expect(res._getType()).toEqual("ai");

      const aiMessage = res as AIMessageChunk;
      console.log(aiMessage);
      expect(aiMessage.content).toBeDefined();
      expect(aiMessage.content.length).toBeGreaterThan(0);
      expect(aiMessage.content[0]).toBeDefined();

      // const content = aiMessage.content[0] as MessageContentComplex;
      // expect(content).toHaveProperty("type");
      // expect(content.type).toEqual("text");

      // const textContent = content as MessageContentText;
      // expect(textContent.text).toBeDefined();
      // expect(textContent.text).toEqual("2");
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  test("generate", async () => {
    const model = new ChatVertexAI();
    try {
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
      console.log(aiMessage);

      // const content = aiMessage.content[0] as MessageContentComplex;
      // expect(content).toHaveProperty("type");
      // expect(content.type).toEqual("text");

      // const textContent = content as MessageContentText;
      // expect(textContent.text).toBeDefined();
      // expect(["H", "T"]).toContainEqual(textContent.text);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  test("stream", async () => {
    const model = new ChatVertexAI();
    try {
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
      const aiChunk = lastChunk as AIMessageChunk;
      console.log(aiChunk);

      console.log(JSON.stringify(resArray, null, 2));
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  test("Tool call", async () => {
    const chat = new ChatVertexAI().bindTools([new WeatherTool()]);
    const res = await chat.invoke("What is the weather in SF and LA");
    console.log(res);
    expect(res.tool_calls?.length).toEqual(1);
    expect(res.tool_calls?.[0].args).toEqual(
      JSON.parse(res.additional_kwargs.tool_calls?.[0].function.arguments ?? "")
    );
  });

  test("Few shotting with tool calls", async () => {
    const chat = new ChatVertexAI().bindTools([new WeatherTool()]);
    const res = await chat.invoke("What is the weather in SF");
    console.log(res);
    const res2 = await chat.invoke([
      new HumanMessage("What is the weather in SF?"),
      new AIMessage({
        content: "",
        tool_calls: [
          {
            id: "12345",
            name: "get_current_weather",
            args: {
              location: "SF",
            },
          },
        ],
      }),
      new ToolMessage({
        tool_call_id: "12345",
        content: "It is currently 24 degrees with hail in SF.",
      }),
      new AIMessage("It is currently 24 degrees in SF with hail in SF."),
      new HumanMessage("What did you say the weather was?"),
    ]);
    console.log(res2);
    expect(res2.content).toContain("24");
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
    try {
      const res = await model.invoke("What is 1 + 1?");
      expect(res).toBeDefined();
      expect(res._getType()).toEqual("ai");

      const aiMessage = res as AIMessageChunk;
      expect(aiMessage.content).toBeDefined();
      expect(aiMessage.content.length).toBeGreaterThan(0);
      expect(aiMessage.content[0]).toBeDefined();
      console.log(aiMessage);

      // const content = aiMessage.content[0] as MessageContentComplex;
      // expect(content).toHaveProperty("type");
      // expect(content.type).toEqual("text");

      // const textContent = content as MessageContentText;
      // expect(textContent.text).toBeDefined();
      // expect(textContent.text).toEqual("2");
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  test("generate", async () => {
    const model = new ChatVertexAI();
    try {
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
      console.log(aiMessage);

      // const content = aiMessage.content[0] as MessageContentComplex;
      // expect(content).toHaveProperty("type");
      // expect(content.type).toEqual("text");

      // const textContent = content as MessageContentText;
      // expect(textContent.text).toBeDefined();
      // expect(["H", "T"]).toContainEqual(textContent.text);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  test("stream", async () => {
    const model = new ChatVertexAI();
    try {
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
      const aiChunk = lastChunk as AIMessageChunk;
      console.log(aiChunk);

      console.log(JSON.stringify(resArray, null, 2));
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
});
