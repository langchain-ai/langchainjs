import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ChatPromptTemplate } from "langchain/prompts";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { JsonOutputToolsParser } from "langchain/output_parsers";

const EXTRACTION_TEMPLATE = `Extract and save the relevant entities mentioned \
in the following passage together with their properties.

If a property is not present and is not required in the function parameters, do not include it in the output.`;

const prompt = ChatPromptTemplate.fromMessages([
  ["system", EXTRACTION_TEMPLATE],
  ["human", "{input}"],
]);

const person = z.object({
  name: z.string().describe("The person's name"),
  age: z.string().describe("The person's age"),
});

const model = new ChatOpenAI({
  modelName: "gpt-3.5-turbo-1106",
  temperature: 0,
}).bind({
  tools: [
    {
      type: "function",
      function: {
        name: "person",
        description: "A person",
        parameters: zodToJsonSchema(person),
      },
    },
  ],
});

const parser = new JsonOutputToolsParser();
const chain = prompt.pipe(model).pipe(parser);

const res = await chain.invoke({
  input: "jane is 2 and bob is 3",
});

console.log(res);
/*
  [
    { name: 'person', arguments: { name: 'jane', age: '2' } },
    { name: 'person', arguments: { name: 'bob', age: '3' } }
  ]
*/
