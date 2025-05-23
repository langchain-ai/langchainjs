import { describe, test } from "@jest/globals";
import { ChatMessage, HumanMessage } from "@langchain/core/messages";
import {
  PromptTemplate,
  ChatPromptTemplate,
  AIMessagePromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { formatToOpenAITool } from "@langchain/openai";
import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatNovitaAI } from "../novita.js";

describe("ChatNovitaAI", () => {
  test("invoke", async () => {
    const chat = new ChatNovitaAI();
    const message = new HumanMessage("Hello! Who are you?");
    const res = await chat.invoke([message]);
    expect(res.content.length).toBeGreaterThan(10);
  });

  test("generate", async () => {
    const chat = new ChatNovitaAI();
    const message = new HumanMessage("Hello! Who are you?");
    const res = await chat.generate([[message]]);
    expect(res.generations[0][0].text.length).toBeGreaterThan(10);
  });

  test("custom messages", async () => {
    const chat = new ChatNovitaAI();
    const res = await chat.invoke([new ChatMessage("Hello!", "user")]);
    expect(res.content.length).toBeGreaterThan(2);
  });

  test("chaining", async () => {
    const chat = new ChatNovitaAI();
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        "You are a helpful assistant that translates {input_language} to {output_language}.",
      ],
      ["human", "{input}"],
    ]);

    const chain = prompt.pipe(chat);
    const response = await chain.invoke({
      input_language: "English",
      output_language: "German",
      input: "I love programming.",
    });

    expect(response.content.length).toBeGreaterThan(10);
  });

  test("prompt templates", async () => {
    const chat = new ChatNovitaAI();

    const systemPrompt = PromptTemplate.fromTemplate(
      "You are a helpful assistant who must always respond like a {job}."
    );

    const chatPrompt = ChatPromptTemplate.fromMessages([
      new SystemMessagePromptTemplate(systemPrompt),
      HumanMessagePromptTemplate.fromTemplate("{text}"),
    ]);

    const responseA = await chat.generatePrompt([
      await chatPrompt.formatPromptValue({
        job: "pirate",
        text: "What would be a good company name a company that makes colorful socks?",
      }),
    ]);
    expect(responseA.generations[0][0].text.length).toBeGreaterThan(10);
  });

  test("longer chain of messages", async () => {
    const chat = new ChatNovitaAI();

    const chatPrompt = ChatPromptTemplate.fromMessages([
      HumanMessagePromptTemplate.fromTemplate(`Hi, my name is Joe!`),
      AIMessagePromptTemplate.fromTemplate(`Nice to meet you, Joe!`),
      HumanMessagePromptTemplate.fromTemplate("{text}"),
    ]);

    const responseA = await chat.generatePrompt([
      await chatPrompt.formatPromptValue({
        text: "What did I just say my name was?",
      }),
    ]);
    expect(responseA.generations[0][0].text.length).toBeGreaterThan(10);
  });

  test("JSON mode", async () => {
    const chat = new ChatNovitaAI().bind({
      response_format: {
        type: "json_object"
      },
    });
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful assistant who responds in JSON. You must return a JSON object with an 'orderedArray' property containing the numbers in descending order."],
      ["human", "Please list this output in order of DESC [1, 4, 2, 8]."],
    ]);
    const res = await prompt.pipe(chat).invoke({});
    expect(typeof res.content).toBe("string");
    expect(JSON.parse(res.content as string)).toMatchObject({
      orderedArray: expect.any(Array),
    });
  });

  test("Tool calls", async () => {
    class CalculatorTool extends StructuredTool {
      name = "Calculator";

      schema = z.object({
        a: z.number(),
        b: z.number(),
      });

      description = "A simple calculator tool.";

      constructor() {
        super();
      }

      async _call(input: { a: number; b: number }) {
        return JSON.stringify({ total: input.a + input.b });
      }
    }
    const tool = formatToOpenAITool(new CalculatorTool());
    const chat = new ChatNovitaAI().bind({
      tools: [tool],
    });
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful assistant."],
      ["human", "What is 1273926 times 27251?"],
    ]);
    const res = await prompt.pipe(chat).invoke({});
    expect(res.tool_calls?.length).toBeGreaterThan(0);
    expect(res.tool_calls?.[0].args)
      .toMatchObject({ a: expect.any(Number), b: expect.any(Number) });
  });
}); 