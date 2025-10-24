import { LLMChain } from "langchain/chains";
import { ChatMinimax } from "@langchain/community/chat_models/minimax";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";

// We can also construct an LLMChain from a ChatPromptTemplate and a chat model.
const chat = new ChatMinimax({ temperature: 0.01 });

const chatPrompt = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(
    "You are a helpful assistant that translates {input_language} to {output_language}."
  ),
  HumanMessagePromptTemplate.fromTemplate("{text}"),
]);
const chainB = new LLMChain({
  prompt: chatPrompt,
  llm: chat,
});

const resB = await chainB.invoke({
  input_language: "English",
  output_language: "Chinese",
  text: "I love programming.",
});
console.log({ resB });
