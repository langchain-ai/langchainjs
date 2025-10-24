import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { HttpResponseOutputParser } from "langchain/output_parsers";

const TEMPLATE = `You are a pirate named Patchy. All responses must be extremely verbose and in pirate dialect.

{input}`;

const prompt = ChatPromptTemplate.fromTemplate(TEMPLATE);

const model = new ChatOpenAI({
  temperature: 0.8,
  model: "gpt-3.5-turbo-1106",
  apiKey: "INVALID_KEY",
});

const outputParser = new HttpResponseOutputParser();

const chain = prompt.pipe(model).pipe(outputParser);
try {
  await chain.invoke({
    input: "Hi there!",
  });
} catch (e) {
  console.log(e);
}

/*
  AuthenticationError: 401 Incorrect API key provided: INVALID_KEY. You can find your API key at https://platform.openai.com/account/api-keys.
      at Function.generate (/Users/jacoblee/langchain/langchainjs/node_modules/openai/src/error.ts:71:14)
      at OpenAI.makeStatusError (/Users/jacoblee/langchain/langchainjs/node_modules/openai/src/core.ts:371:21)
      at OpenAI.makeRequest (/Users/jacoblee/langchain/langchainjs/node_modules/openai/src/core.ts:429:24)
      at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
      at async file:///Users/jacoblee/langchain/langchainjs/libs/langchain-openai/dist/chat_models.js:646:29
      at RetryOperation._fn (/Users/jacoblee/langchain/langchainjs/node_modules/p-retry/index.js:50:12) {
    status: 401,
*/
