import { test } from "@jest/globals";
import { HumanMessage } from "@langchain/core/messages";
import { NIBittensorChatModel } from "../bittensor.js";

test.skip("Test", async () => {
  const chat = new NIBittensorChatModel();
  const message = new HumanMessage("What is bittensor?");
  const res = await chat.call([message]);
  console.log({ res });
});
