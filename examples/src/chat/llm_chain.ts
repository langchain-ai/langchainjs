import { LLMChain } from "langchain";
import { ChatOpenAI } from "langchain/chat_models";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";

export const run = async () => {
  const chat = new ChatOpenAI({ temperature: 0 });

  const chatPrompt = ChatPromptTemplate.fromPromptMessages([
    SystemMessagePromptTemplate.fromTemplate(
      "You are a helpful assistant that translates {input_language} to {output_language}."
    ),
    HumanMessagePromptTemplate.fromTemplate("{text}"),
  ]);

  const chain = new LLMChain({
    prompt: chatPrompt,
    llm: chat,
  });

  const response = await chain.call({
    input_language: "English",
    output_language: "French",
    text: "I love programming.",
  });

  console.log(response);
};
