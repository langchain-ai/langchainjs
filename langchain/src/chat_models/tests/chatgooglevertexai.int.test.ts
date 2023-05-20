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
