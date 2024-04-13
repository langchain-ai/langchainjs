import { z } from "zod";
import { OpenAI, ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "langchain/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";

const prompt = PromptTemplate.fromTemplate(
  `Return a JSON object containing the following value wrapped in an "input" key. Do not return anything else:\n{input}`
);

const badModel = new OpenAI({
  maxRetries: 0,
  model: "gpt-3.5-turbo-instruct",
});

const normalModel = new ChatOpenAI({
  model: "gpt-4",
});

const outputParser = StructuredOutputParser.fromZodSchema(
  z.object({
    input: z.string(),
  })
);

const badChain = prompt.pipe(badModel).pipe(outputParser);

const goodChain = prompt.pipe(normalModel).pipe(outputParser);

try {
  const result = await badChain.invoke({
    input: "testing0",
  });
} catch (e) {
  console.log(e);
  /*
  OutputParserException [Error]: Failed to parse. Text: "

  { "name" : " Testing0 ", "lastname" : " testing ", "fullname" : " testing ", "role" : " test ", "telephone" : "+1-555-555-555 ", "email" : " testing@gmail.com ", "role" : " test ", "text" : " testing0 is different than testing ", "role" : " test ", "immediate_affected_version" : " 0.0.1 ", "immediate_version" : " 1.0.0 ", "leading_version" : " 1.0.0 ", "version" : " 1.0.0 ", "finger prick" : " no ", "finger prick" : " s ", "text" : " testing0 is different than testing ", "role" : " test ", "immediate_affected_version" : " 0.0.1 ", "immediate_version" : " 1.0.0 ", "leading_version" : " 1.0.0 ", "version" : " 1.0.0 ", "finger prick" :". Error: SyntaxError: Unexpected end of JSON input
*/
}

const chain = badChain.withFallbacks({
  fallbacks: [goodChain],
});

const result = await chain.invoke({
  input: "testing",
});

console.log(result);

/*
  { input: 'testing' }
*/
