import { test } from "@jest/globals";
import { HumanMessage } from "@langchain/core/messages";
import { ChatFriendli } from "../friendli.js";

describe.skip("ChatFriendli", () => {
  test("call", async () => {
    const chatFriendli = new ChatFriendli({ maxTokens: 20 });
    const message = new HumanMessage("1 + 1 = ");
    const res = await chatFriendli.invoke([message]);
    console.log({ res });
  });

  test("generate", async () => {
    const chatFriendli = new ChatFriendli({ maxTokens: 20 });
    const message = new HumanMessage("1 + 1 = ");
    const res = await chatFriendli.generate([[message]]);
    console.log(JSON.stringify(res, null, 2));
  });
});
