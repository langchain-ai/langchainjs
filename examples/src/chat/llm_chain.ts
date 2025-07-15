import { LLMChain } from "langchain/chains";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";

export const run = async () => {
  const chat = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });

  const chatPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "You are a helpful assistant that translates {input_language} to {output_language}.",
    ],
    ["human", "{text}"],
  ]);

  const chain = new LLMChain({
    prompt: chatPrompt,
    llm: chat,
  });

  const response = await chain.invoke({
    input_language: "English",
    output_language: "French",
    text: "I love programming.",
  });

  console.log(response);
};
