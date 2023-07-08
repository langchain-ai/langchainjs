import { z } from "zod";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "langchain/prompts";
import { createStructuredOutputChainFromZod } from "langchain/chains/openai_functions";

const zodSchema = z.object({
  foods: z
    .array(
      z.object({
        name: z.string().describe("The name of the food item"),
        healthy: z.boolean().describe("Whether the food is good for you"),
        color: z.string().optional().describe("The color of the food"),
      })
    )
    .describe("An array of food items mentioned in the text"),
});

const prompt = new ChatPromptTemplate({
  promptMessages: [
    SystemMessagePromptTemplate.fromTemplate(
      "List all food items mentioned in the following text."
    ),
    HumanMessagePromptTemplate.fromTemplate("{inputText}"),
  ],
  inputVariables: ["inputText"],
});

const llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo-0613", temperature: 0 });

const chain = createStructuredOutputChainFromZod(zodSchema, {
  prompt,
  llm,
});

const response = await chain.call({
  inputText: "I like apples, bananas, oxygen, and french fries.",
});

console.log(JSON.stringify(response, null, 2));

/*
  {
    "output": {
      "foods": [
        {
          "name": "apples",
          "healthy": true,
          "color": "red"
        },
        {
          "name": "bananas",
          "healthy": true,
          "color": "yellow"
        },
        {
          "name": "french fries",
          "healthy": false,
          "color": "golden"
        }
      ]
    }
  }
*/
