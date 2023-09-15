import { test } from "@jest/globals";
import { NIBittensorChatModel } from "../bittensor.js";
import { HumanMessage } from "../../../schema/index.js";

test("Test", async () => {
  const chat = new NIBittensorChatModel();
  const message = new HumanMessage("What is bittensor?");
  const res = await chat.call([message]);
  console.log({ res });
});
