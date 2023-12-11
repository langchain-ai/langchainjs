/* eslint-disable @typescript-eslint/no-explicit-any */

import { expect, test } from "@jest/globals";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { ChatOpenAI } from "../../chat_models/openai.js";
import { ChatPromptTemplate } from "../../prompts/index.js";
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
    modelName: "gpt-3.5-turbo-1106",
    temperature: 0,
  }).bind({
    tools: [
      {
        type: "function",
        function: {
          name: "joke",
          description: "A joke",
          parameters: zodToJsonSchema(schema),
        },
      },
    ],
  });

  const parser = new JsonOutputToolsParser();
  const chain = prompt.pipe(model).pipe(parser);

  const res = await chain.invoke({
    foo: "bears",
  });

  console.log(res);
  expect(res.length).toBe(2);
});
