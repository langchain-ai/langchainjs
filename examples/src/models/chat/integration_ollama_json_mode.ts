import { ChatOllama } from "langchain/chat_models/ollama";
import { ChatPromptTemplate } from "langchain/prompts";

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are an expert translator. Format all responses as JSON objects with two keys: "original" and "translated".`,
  ],
  ["human", `Translate "{input}" into {language}.`],
]);

const model = new ChatOllama({
  baseUrl: "http://localhost:11434", // Default value
  model: "llama2", // Default value
  format: "json",
});

const chain = prompt.pipe(model);

const result = await chain.invoke({
  input: "I love programming",
  language: "German",
});

console.log(result);

/*
  AIMessage {
    content: '{"original": "I love programming", "translated": "Ich liebe das Programmieren"}',
    additional_kwargs: {}
  }
*/
