import { test } from "@jest/globals";
// eslint-disable-next-line import/no-extraneous-dependencies
import { z } from "zod";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { ChatPromptValue } from "@langchain/core/prompt_values";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  BaseMessageChunk,
  HumanMessage,
  // MessageContentComplex,
  // MessageContentText,
  SystemMessage,
} from "@langchain/core/messages";
import { ConsoleCallbackHandler } from "@langchain/core/tracers/console";
import { ChatVertexAI } from "../chat_models.js";
import { VertexAI } from "../llms.js";

describe("GAuth Chat", () => {
  test("platform", async () => {
    const model = new VertexAI();
    expect(model.platform).toEqual("gcp");
  });

  test("invoke", async () => {
    const model = new ChatVertexAI();
    try {
      const res = await model.invoke("What is 1 + 1?");
      expect(res).toBeDefined();
      expect(res._getType()).toEqual("ai");

      const aiMessage = res as AIMessageChunk;
      expect(aiMessage.content).toBeDefined();

      expect(typeof aiMessage.content).toBe("string");
      const text = aiMessage.content as string;
      expect(text).toMatch(/(1 + 1 (equals|is|=) )?2.? ?/);

      /*
      expect(aiMessage.content.length).toBeGreaterThan(0);
      expect(aiMessage.content[0]).toBeDefined();
      const content = aiMessage.content[0] as MessageContentComplex;
      expect(content).toHaveProperty("type");
      expect(content.type).toEqual("text");

      const textContent = content as MessageContentText;
      expect(textContent.text).toBeDefined();
      expect(textContent.text).toEqual("2");
      */
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

      expect(typeof aiMessage.content).toBe("string");
      const text = aiMessage.content as string;
      expect(["H", "T"]).toContainEqual(text);

      /*
      expect(aiMessage.content.length).toBeGreaterThan(0);
      expect(aiMessage.content[0]).toBeDefined();

      const content = aiMessage.content[0] as MessageContentComplex;
      expect(content).toHaveProperty("type");
      expect(content.type).toEqual("text");

      const textContent = content as MessageContentText;
      expect(textContent.text).toBeDefined();
      expect(["H", "T"]).toContainEqual(textContent.text);
      */
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

  test("structuredOutput", async () => {
    const handler = new ConsoleCallbackHandler();

    const calculatorSchema = z.object({
      operation: z
        .enum(["add", "subtract", "multiply", "divide"])
        .describe("The type of operation to execute"),
      number1: z.number().describe("The first number to operate on."),
      number2: z.number().describe("The second number to operate on."),
    });

    const model = new ChatVertexAI({
      temperature: 0.7,
      model: "gemini-1.0-pro",
      callbacks: [handler],
    }).withStructuredOutput(calculatorSchema);

    const response = await model.invoke("What is 1628253239 times 81623836?");
    expect(response).toHaveProperty("operation");
    expect(response.operation).toEqual("multiply");
    expect(response).toHaveProperty("number1");
    expect(response.number1).toEqual(1628253239);
    expect(response).toHaveProperty("number2");
    expect(response.number2).toEqual(81623836);
  });
});
