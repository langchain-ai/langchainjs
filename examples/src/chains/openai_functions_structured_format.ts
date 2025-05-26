import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "@langchain/core/prompts";
import { JsonOutputFunctionsParser } from "@langchain/core/output_parsers/openai_functions";

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

const llm = new ChatOpenAI({ model: "gpt-3.5-turbo-0613", temperature: 0 });

// Binding "function_call" below makes the model always call the specified function.
// If you want to allow the model to call functions selectively, omit it.
const functionCallingModel = llm
  .bindTools([
    {
      name: "output_formatter",
      description: "Should always be used to properly format output",
      parameters: zodToJsonSchema(zodSchema),
    },
  ])
  .withConfig({
    function_call: { name: "output_formatter" },
  });

const outputParser = new JsonOutputFunctionsParser();

const chain = prompt.pipe(functionCallingModel).pipe(outputParser);

const response = await chain.invoke({
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
