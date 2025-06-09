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
import { ChatTogetherAI } from "../togetherai.js";

describe("ChatTogetherAI", () => {
  test("invoke", async () => {
    const chat = new ChatTogetherAI();
    const message = new HumanMessage("Hello!");
    const res = await chat.invoke([message]);
    // console.log({ res });
    expect(res.content.length).toBeGreaterThan(10);
  });

  test("generate", async () => {
    const chat = new ChatTogetherAI();
    const message = new HumanMessage("Hello!");
    const res = await chat.generate([[message]]);
    // console.log(JSON.stringify(res, null, 2));
    expect(res.generations[0][0].text.length).toBeGreaterThan(10);
  });

  test("custom messages", async () => {
    const chat = new ChatTogetherAI();
    const res = await chat.invoke([new ChatMessage("Hello!", "user")]);
    // console.log({ res });
    expect(res.content.length).toBeGreaterThan(10);
  });

  test("prompt templates", async () => {
    const chat = new ChatTogetherAI();

    // PaLM doesn't support translation yet
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

    // console.log(responseA.generations);
    expect(responseA.generations[0][0].text.length).toBeGreaterThan(10);
  });

  test("longer chain of messages", async () => {
    const chat = new ChatTogetherAI();

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

    // console.log(responseA.generations);
    expect(responseA.generations[0][0].text.length).toBeGreaterThan(10);
  });

  test("JSON mode", async () => {
    const responseSchema = {
      type: "object",
      properties: {
        orderedArray: {
          type: "array",
          items: {
            type: "number",
          },
        },
      },
      required: ["orderedArray"],
    };
    const chat = new ChatTogetherAI().withConfig({
      response_format: {
        type: "json_object",
        schema: responseSchema,
      },
    });
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful assistant who responds in JSON."],
      ["human", "Please list this output in order of DESC [1, 4, 2, 8]."],
    ]);
    const res = await prompt.pipe(chat).invoke({});
    // console.log({ res });
    expect(typeof res.content).toEqual("string");
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
    const chat = new ChatTogetherAI().bindTools([tool], { tool_choice: tool });
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful assistant."],
      ["human", "What is 1273926 times 27251?"],
    ]);
    const res = await prompt.pipe(chat).invoke({});
    // console.log({ res });
    expect(res.additional_kwargs.tool_calls?.length).toBeGreaterThan(0);
    expect(
      JSON.parse(res.additional_kwargs.tool_calls?.[0].function.arguments ?? "")
    ).toMatchObject({ a: expect.any(Number), b: expect.any(Number) });
  });
});
