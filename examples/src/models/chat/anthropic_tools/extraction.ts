import { z } from "zod";

import { ChatAnthropic } from "@langchain/anthropic";
import { PromptTemplate } from "@langchain/core/prompts";
import { JsonOutputToolsParser } from "@langchain/core/output_parsers/openai_tools";

const EXTRACTION_TEMPLATE = `Extract and save the relevant entities mentioned in the following passage together with their properties.

Passage:
{input}
`;

const prompt = PromptTemplate.fromTemplate(EXTRACTION_TEMPLATE);

// Use Zod for easier schema declaration
const schema = z.object({
  name: z.string().describe("The name of a person"),
  height: z.number().describe("The person's height"),
  hairColor: z.optional(z.string()).describe("The person's hair color"),
});

const model = new ChatAnthropic({
  temperature: 0.1,
  model: "claude-3-sonnet-20240229",
})
  .bindTools([
    {
      name: "person",
      description: "Extracts the relevant people from the passage.",
      schema,
    },
  ])
  .withConfig({
    // Can also set to "auto" to let the model choose a tool
    tool_choice: {
      type: "tool",
      name: "person",
    },
  });

// Use a JsonOutputToolsParser to get the parsed JSON response directly.
const chain = await prompt.pipe(model).pipe(new JsonOutputToolsParser());

const response = await chain.invoke({
  input:
    "Alex is 5 feet tall. Claudia is 1 foot taller than Alex and jumps higher than him. Claudia is a brunette and Alex is blonde.",
});

console.log(JSON.stringify(response, null, 2));

/*
  [
    {
      "type": "person",
      "args": {
        "name": "Alex",
        "height": 5,
        "hairColor": "blonde"
      }
    },
    {
      "type": "person",
      "args": {
        "name": "Claudia",
        "height": 6,
        "hairColor": "brunette"
      }
    }
  ]
*/
