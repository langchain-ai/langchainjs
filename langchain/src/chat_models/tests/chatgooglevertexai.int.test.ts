import { test } from "@jest/globals";
import { HumanChatMessage } from "../../schema/index.js";
import { ChatGoogleVertexAi } from "../googlevertexai.js";

test("Test ChatGoogleVertexAi", async () => {
  const chat = new ChatGoogleVertexAi();
  const message = new HumanChatMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

test("Test ChatGoogleVertexAi generate", async () => {
  const chat = new ChatGoogleVertexAi();
  const message = new HumanChatMessage("Hello!");
  const res = await chat.generate([[message]]);
  console.log(JSON.stringify(res, null, 1));
});

test("Test ChatGoogleVertexAi context", async () => {
  const model = new ChatGoogleVertexAi({
    temperature: 0.7,
    context: "You are a helpful assistant that answers in pirate language.",
  });
  const question = new HumanChatMessage(
    "Question: What would be a good company name a company that makes colorful socks?\nAnswer:"
  );
  const res = await model.call([question]);
  console.log({ res });
});
