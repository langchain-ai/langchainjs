import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
} from "langchain/prompts";
import { LLMChain } from "langchain/chains";

import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanMessage, SystemMessage } from "langchain/schema";

const chat = new ChatOpenAI({ temperature: 0 });

// const response = await chat.call([
//     new HumanMessage(
//         "Translate this sentence from English to Chinese. I love programming."
//     ),
// ]);

// console.log('单条消息：', JSON.stringify(response));

// const responseB = await chat.call([
//     new SystemMessage(
//         "You are a helpful assistant that translates English to Chinese."
//     ),
//     new HumanMessage("Translate: I love programming."),
// ]);

// console.log('多条消息:', JSON.stringify(responseB));

// const responseC = await chat.generate([
//     [
//         new SystemMessage(
//             "You are a helpful assistant that translates English to Chinese."
//         ),
//         new HumanMessage(
//             "Translate this sentence from English to Chinese. I love programming."
//         ),
//     ],
//     [
//         new SystemMessage(
//             "You are a helpful assistant that translates English to Chinese."
//         ),
//         new HumanMessage(
//             "Translate this sentence from English to Chinese. I love artificial intelligence."
//         ),
//     ],
// ]);

// console.log('批量请求：', JSON.stringify(responseC));

const translationPrompt = ChatPromptTemplate.fromPromptMessages([
  SystemMessagePromptTemplate.fromTemplate(
    "You are a helpful assistant that translates {input_language} to {output_language}."
  ),
  HumanMessagePromptTemplate.fromTemplate("{text}"),
]);

// const responseA = await chat.generatePrompt([
//     await translationPrompt.formatPromptValue({
//         input_language: "English",
//         output_language: "Chinese",
//         text: "I love programming.",
//     }),
// ]);

// console.log('模板消息:', JSON.stringify(responseA));

const chain = new LLMChain({
  prompt: translationPrompt,
  llm: chat,
});

const responseD = await chain.call({
  input_language: "English",
  output_language: "Chinese",
  text: "I love programming.",
});

console.log(responseD);
