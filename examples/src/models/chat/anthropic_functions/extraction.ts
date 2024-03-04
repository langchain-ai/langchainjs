import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { AnthropicFunctions } from "@langchain/anthropic/experimental";
import { JsonOutputFunctionsParser } from "langchain/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";

const EXTRACTION_TEMPLATE = `Extract and save the relevant entities mentioned in the following passage together with their properties.

Passage:
{input}
`;

const prompt = PromptTemplate.fromTemplate(EXTRACTION_TEMPLATE);

// Use Zod for easier schema declaration
const schema = z.object({
  people: z.array(
    z.object({
      name: z.string().describe("The name of a person"),
      height: z.number().describe("The person's height"),
      hairColor: z.optional(z.string()).describe("The person's hair color"),
    })
  ),
});

const model = new AnthropicFunctions({
  temperature: 0.1,
  modelName: "claude-3-sonnet-20240229",
}).bind({
  functions: [
    {
      name: "information_extraction",
      description: "Extracts the relevant information from the passage.",
      parameters: zodToJsonSchema(schema),
    },
  ],
  function_call: {
    name: "information_extraction",
  },
});

// Use a JsonOutputFunctionsParser to get the parsed JSON response directly.
const chain = await prompt.pipe(model).pipe(new JsonOutputFunctionsParser());

const response = await chain.invoke({
  input:
    "Alex is 5 feet tall. Claudia is 1 foot taller than Alex and jumps higher than him. Claudia is a brunette and Alex is blonde.",
});

console.log(JSON.stringify(response, null, 2));

/*
  {
    people: [
      { name: 'Alex', height: 5, hairColor: 'blonde' },
      { name: 'Claudia', height: 6, hairColor: 'brunette' }
    ]
  }
*/
