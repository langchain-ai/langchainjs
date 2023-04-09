import { OpenAI } from "langchain/llms/openai";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { LLMChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models/openai";

export const run = async () => {
  // We can construct an LLMChain from a PromptTemplate and an LLM.
  const model = new OpenAI({ temperature: 0 });
  const template = "What is a good name for a company that makes {product}?";
  const prompt = new PromptTemplate({ template, inputVariables: ["product"] });
  const chainA = new LLMChain({ llm: model, prompt });
  const resA = await chainA.call({ product: "colorful socks" });
  // The result is an object with a `text` property.
  console.log({ resA });
  // { resA: { text: '\n\nSocktastic!' } }

  // Since the LLMChain is a single-input, single-output chain, we can also call it with `run`.
  // This takes in a string and returns the `text` property.
  const resA2 = await chainA.run("colorful socks");
  console.log({ resA2 });
  // { resA2: '\n\nSocktastic!' }

  // We can also construct an LLMChain from a ChatPromptTemplate and a chat model.
  const chat = new ChatOpenAI({ temperature: 0 });
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
    output_language: "French",
    text: "I love programming.",
  });
  console.log({ resB });
  // { resB: { text: "J'adore la programmation." } }
};
