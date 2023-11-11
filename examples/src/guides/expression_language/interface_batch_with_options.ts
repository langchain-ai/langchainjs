import { PromptTemplate } from "langchain/prompts";
import { ChatOpenAI } from "langchain/chat_models/openai";

const model = new ChatOpenAI({
  modelName: "badmodel",
});
const promptTemplate = PromptTemplate.fromTemplate(
  "Tell me a joke about {topic}"
);

const chain = promptTemplate.pipe(model);

const result = await chain.batch(
  [{ topic: "bears" }, { topic: "cats" }],
  {},
  { returnExceptions: true, maxConcurrency: 1 }
);

console.log(result);
/*
  [
    NotFoundError: The model `badmodel` does not exist
      at Function.generate (/Users/jacoblee/langchain/langchainjs/node_modules/openai/src/error.ts:71:6)
      at OpenAI.makeStatusError (/Users/jacoblee/langchain/langchainjs/node_modules/openai/src/core.ts:381:13)
      at OpenAI.makeRequest (/Users/jacoblee/langchain/langchainjs/node_modules/openai/src/core.ts:442:15)
      at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
      at async file:///Users/jacoblee/langchain/langchainjs/langchain/dist/chat_models/openai.js:514:29
      at RetryOperation._fn (/Users/jacoblee/langchain/langchainjs/node_modules/p-retry/index.js:50:12) {
    status: 404,
    NotFoundError: The model `badmodel` does not exist
        at Function.generate (/Users/jacoblee/langchain/langchainjs/node_modules/openai/src/error.ts:71:6)
        at OpenAI.makeStatusError (/Users/jacoblee/langchain/langchainjs/node_modules/openai/src/core.ts:381:13)
        at OpenAI.makeRequest (/Users/jacoblee/langchain/langchainjs/node_modules/openai/src/core.ts:442:15)
        at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
        at async file:///Users/jacoblee/langchain/langchainjs/langchain/dist/chat_models/openai.js:514:29
        at RetryOperation._fn (/Users/jacoblee/langchain/langchainjs/node_modules/p-retry/index.js:50:12) {
      status: 404,
  ]
*/
