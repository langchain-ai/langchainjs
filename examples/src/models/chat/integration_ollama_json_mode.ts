import { ChatOllama } from "@langchain/ollama";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are an expert translator. Format all responses as JSON objects with two keys: "original" and "translated".`,
  ],
  ["human", `Translate "{input}" into {language}.`],
]);

const model = new ChatOllama({
  baseUrl: "http://localhost:11434", // Default value
  model: "llama3",
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
  "content": "{\n\"original\": \"I love programming\",\n\"translated\": \"Ich liebe Programmieren\"\n}",
  "response_metadata": { ... },
  "usage_metadata": {
    "input_tokens": 47,
    "output_tokens": 20,
    "total_tokens": 67
  }
}
*/
