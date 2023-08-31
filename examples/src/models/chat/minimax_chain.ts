import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { LLMChain } from "langchain/chains";
import { ChatMinimax } from "langchain/chat_models/minimax";

// We can also construct an LLMChain from a ChatPromptTemplate and a chat model.
const chat = new ChatMinimax({ temperature: 0.01 });

const chatPrompt = ChatPromptTemplate.fromPromptMessages([
  SystemMessagePromptTemplate.fromTemplate(
    "You are a helpful assistant that translates {input_language} to {output_language}."
  ),
  HumanMessagePromptTemplate.fromTemplate("{text}"),
]);
const chainB = new LLMChain({
  prompt: chatPrompt,
  llm: chat,
});

const resB = await chainB.call({
  input_language: "English",
  output_language: "Chinese",
  text: "I love programming.",
});
console.log({ resB });
