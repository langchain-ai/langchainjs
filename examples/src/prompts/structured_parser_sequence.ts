import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";
import { StructuredOutputParser } from "langchain/output_parsers";
import { RunnableSequence } from "langchain/schema/runnable";

const parser = StructuredOutputParser.fromNamesAndDescriptions({
  answer: "answer to the user's question",
  source: "source used to answer the user's question, should be a website.",
});

const chain = RunnableSequence.from([
  PromptTemplate.fromTemplate(
    "Answer the users question as best as possible.\n{format_instructions}\n{question}"
  ),
  new OpenAI({ temperature: 0 }),
  parser,
]);

console.log(parser.getFormatInstructions());

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

const response = await chain.invoke({
  question: "What is the capital of France?",
  format_instructions: parser.getFormatInstructions(),
});

console.log(response);
// { answer: 'Paris', source: 'https://en.wikipedia.org/wiki/Paris' }
