import { test } from "@jest/globals";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatMistralAI } from "../chat_models.js";
import { MistralAIEmbeddings } from "../embeddings.js";

test("Test ChatMistralAI can invoke", async () => {
  const model = new ChatMistralAI();
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["human", "{input}"],
  ]);
  const response = await prompt.pipe(model).invoke({
    input: "Hello",
  });
  console.log("response", response);
  expect(response.content.length).toBeGreaterThan(1);
});

test("Test ChatMistralAI can stream", async () => {
  const model = new ChatMistralAI();
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["human", "{input}"],
  ]);
  const response = await prompt.pipe(model).stream({
    input: "Hello",
  });
  let itters = 0;
  let fullMessage = "";
  for await (const item of response) {
    console.log(item);
    itters += 1;
    fullMessage += item.content;
  }
  console.log("fullMessage", fullMessage);
  expect(itters).toBeGreaterThan(1);
});

test("Test MistralAIEmbeddings can embed query", async () => {
  const model = new MistralAIEmbeddings();
  // "Hello world" in French 🤓
  const text = "Bonjour le monde";
  const embeddings = await model.embedQuery(text);
  console.log("embeddings", embeddings);
  expect(embeddings.length).toBe(1024);
});

test("Test MistralAIEmbeddings can embed documents", async () => {
  const model = new MistralAIEmbeddings();
  // "Hello world" in French 🤓
  const text = "Bonjour le monde";
  const documents = [text, text];
  const embeddings = await model.embedDocuments(documents);
  console.log("embeddings", embeddings);
  expect(embeddings.length).toBe(2);
  expect(embeddings[0].length).toBe(1024);
  expect(embeddings[1].length).toBe(1024);
});
