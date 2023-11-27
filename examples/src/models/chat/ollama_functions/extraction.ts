import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { OllamaFunctions } from "langchain/experimental/chat_models/ollama_functions";
import { PromptTemplate } from "langchain/prompts";
import { JsonOutputFunctionsParser } from "langchain/output_parsers";

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

const model = new OllamaFunctions({
  temperature: 0.1,
  model: "mistral",
}).bind({
  functions: [
    {
      name: "information_extraction",
      description: "Extracts the relevant information from the passage.",
      parameters: {
        type: "object",
        properties: zodToJsonSchema(schema),
      },
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
    "Alex is 5 feet tall. Claudia is 1 foot taller than Alex and jumps higher than him. Claudia has orange hair and Alex is blonde.",
});

console.log(response);

/*
  {
    people: [
      { name: 'Alex', height: 5, hairColor: 'blonde' },
      { name: 'Claudia', height: 6, hairColor: 'orange' }
    ]
  }
*/
