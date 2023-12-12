import { test } from "@jest/globals";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatMistralAI } from "../chat_models.js";
import { MistralAIEmbeddings } from "../embeddings.js";

test.only("Test ChatMistralAI can invoke", async () => {
  // const model = new ChatMistralAI();
  const prompt = ChatPromptTemplate.fromMessages([
    ["ai", "You are a helpful assistant"],
    ["human", "{input}"]
  ]);
  const promptFormatted = await prompt.format({
    input: "Hello"
  });
  console.log("promptFormatted", promptFormatted);
  // const response = await prompt.pipe(model).invoke({
  //   input: "Hello"
  // });
  // console.log("response", response);
  // expect(response.content.length).toBeGreaterThan(1);
});

test("Test ChatMistralAI can stream", async () => {
  const model = new ChatMistralAI();
  const prompt = ChatPromptTemplate.fromMessages([
    ["ai", "You are a helpful assistant"],
    ["human", "{input}"]
  ]);
  const response = await prompt.pipe(model).stream({
    input: "Hello"
  });
  let itters = 0;
  for await (const item of response) {
    console.log(item);
    itters += 1;
  }
  console.log("response", response);
  expect(itters).toBeGreaterThan(1);
});

test("Test MistralAIEmbeddings can embed query", async () => {
  const model = new MistralAIEmbeddings();
  // "Hello world" in French 🤓
  const text = "Bonjour le monde";
  const embeddings = await model.embedQuery(text);
  expect(embeddings.length).toBeGreaterThan(1);
});

test("Test MistralAIEmbeddings can embed documents", async () => {
  const model = new MistralAIEmbeddings();
  // "Hello world" in French 🤓
  const text = "Bonjour le monde";
  const documents = [text, text];
  const embeddings = await model.embedDocuments(documents);
  expect(embeddings.length).toBe(2);
  expect(embeddings[0].length).toBeGreaterThan(1);
  expect(embeddings[1].length).toBeGreaterThan(1);
});
