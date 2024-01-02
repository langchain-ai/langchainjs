/* eslint-disable import/first */
import { ChatOpenAI } from "langchain/chat_models/openai";

const chatModel = new ChatOpenAI({});

console.log(await chatModel.invoke("what is LangSmith?"));

/*
  AIMessage {
    content: 'Langsmith can help with testing by generating test cases, automating the testing process, and analyzing test results.',
    name: undefined,
    additional_kwargs: { function_call: undefined, tool_calls: undefined }
  }
*/

import { ChatPromptTemplate } from "@langchain/core/prompts";

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a world class technical documentation writer."],
  ["user", "{input}"],
]);

const chain = prompt.pipe(chatModel);

console.log(
  await chain.invoke({
    input: "what is LangSmith?",
  })
);

import { StringOutputParser } from "@langchain/core/output_parsers";

const outputParser = new StringOutputParser();

const llmChain = prompt.pipe(chatModel).pipe(outputParser);

console.log(
  await llmChain.invoke({
    input: "what is LangSmith?",
  })
);
