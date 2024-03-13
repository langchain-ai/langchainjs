import { z } from "zod";
import { OpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "langchain/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";

// We can use zod to define a schema for the output using the `fromZodSchema` method of `StructuredOutputParser`.
const parser = StructuredOutputParser.fromZodSchema(
  z.object({
    answer: z.string().describe("answer to the user's question"),
    sources: z
      .array(z.string())
      .describe("sources used to answer the question, should be websites."),
  })
);

const formatInstructions = parser.getFormatInstructions();

const prompt = new PromptTemplate({
  template:
    "Answer the users question as best as possible.\n{format_instructions}\n{question}",
  inputVariables: ["question"],
  partialVariables: { format_instructions: formatInstructions },
});

const model = new OpenAI({ temperature: 0 });

const input = await prompt.format({
  question: "What is the capital of France?",
});
const response = await model.invoke(input);

console.log(input);
/*
Answer the users question as best as possible.
The output should be formatted as a JSON instance that conforms to the JSON schema below.

As an example, for the schema {{"properties": {{"foo": {{"title": "Foo", "description": "a list of strings", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of the schema. The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

Here is the output schema:
```
{"type":"object","properties":{"answer":{"type":"string","description":"answer to the user's question"},"sources":{"type":"array","items":{"type":"string"},"description":"sources used to answer the question, should be websites."}},"required":["answer","sources"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}
```

What is the capital of France?
*/

console.log(response);
/*
{"answer": "Paris", "sources": ["https://en.wikipedia.org/wiki/Paris"]}
*/

console.log(await parser.parse(response));
/*
{ answer: 'Paris', sources: [ 'https://en.wikipedia.org/wiki/Paris' ] }
*/
