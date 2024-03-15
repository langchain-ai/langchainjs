import { OpenAI } from "@langchain/openai";
import {
  StructuredOutputParser,
  RegexParser,
  CombiningOutputParser,
} from "langchain/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";

const answerParser = StructuredOutputParser.fromNamesAndDescriptions({
  answer: "answer to the user's question",
  source: "source used to answer the user's question, should be a website.",
});

const confidenceParser = new RegexParser(
  /Confidence: (A|B|C), Explanation: (.*)/,
  ["confidence", "explanation"],
  "noConfidence"
);

const parser = new CombiningOutputParser(answerParser, confidenceParser);
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
Return the following outputs, each formatted as described below:

Output 1:
The output should be formatted as a JSON instance that conforms to the JSON schema below.

As an example, for the schema {{"properties": {{"foo": {{"title": "Foo", "description": "a list of strings", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of the schema. The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

Here is the output schema:
```
{"type":"object","properties":{"answer":{"type":"string","description":"answer to the user's question"},"source":{"type":"string","description":"source used to answer the user's question, should be a website."}},"required":["answer","source"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}
```

Output 2:
Your response should match the following regex: /Confidence: (A|B|C), Explanation: (.*)/

What is the capital of France?
*/

console.log(response);
/*
Output 1:
{"answer":"Paris","source":"https://www.worldatlas.com/articles/what-is-the-capital-of-france.html"}

Output 2:
Confidence: A, Explanation: The capital of France is Paris.
*/

console.log(await parser.parse(response));
/*
{
  answer: 'Paris',
  source: 'https://www.worldatlas.com/articles/what-is-the-capital-of-france.html',
  confidence: 'A',
  explanation: 'The capital of France is Paris.'
}
*/
