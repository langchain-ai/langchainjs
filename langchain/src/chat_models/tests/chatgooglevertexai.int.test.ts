import { test } from "@jest/globals";
import { HumanChatMessage } from "../../schema/index.js";
import { ChatGoogleVertexAI } from "../googlevertexai.js";

test("Test ChatGoogleVertexAI", async () => {
  const chat = new ChatGoogleVertexAI();
  const message = new HumanChatMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

test("Test ChatGoogleVertexAI generate", async () => {
  const chat = new ChatGoogleVertexAI();
  const message = new HumanChatMessage("Hello!");
  const res = await chat.generate([[message]]);
  console.log(JSON.stringify(res, null, 1));
});

test("Test ChatGoogleVertexAI context", async () => {
  const model = new ChatGoogleVertexAI({
    temperature: 0.7,
    context: "You are a helpful assistant that answers in pirate language.",
  });
  const question = new HumanChatMessage(
    "Question: What would be a good company name a company that makes colorful socks?\nAnswer:"
  );
  const res = await model.call([question]);
  console.log({ res });
});
