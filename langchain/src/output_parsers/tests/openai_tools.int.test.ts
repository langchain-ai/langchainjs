/* eslint-disable @typescript-eslint/no-explicit-any */

import { expect, test } from "@jest/globals";
import { z } from "zod";

import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { isInteropZodSchema } from "@langchain/core/utils/types";
import { JsonOutputToolsParser } from "../openai_tools.js";

const schema = z.object({
  setup: z.string().describe("The setup for the joke"),
  punchline: z.string().describe("The punchline to the joke"),
});

test("Extraction", async () => {
  const prompt = ChatPromptTemplate.fromTemplate(
    `tell me two jokes about {foo}`
  );
  const model = new ChatOpenAI({
    model: "gpt-3.5-turbo-1106",
    temperature: 0,
  }).bindTools([
    {
      type: "function",
      function: {
        name: "joke",
        description: "A joke",
        parameters: isInteropZodSchema(schema) ? toJsonSchema(schema) : schema,
      },
    },
  ]);

  const parser = new JsonOutputToolsParser();
  const chain = prompt.pipe(model).pipe(parser);

  const res = await chain.invoke({
    foo: "bears",
  });

  // console.log(res);
  expect(res.length).toBe(2);
});
