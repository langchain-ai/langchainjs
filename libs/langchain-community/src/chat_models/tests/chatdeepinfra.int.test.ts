import { test } from "@jest/globals";
import { HumanMessage } from "@langchain/core/messages";
import { ChatDeepInfra } from "../deepinfra.js";

describe("ChatDeepInfra", () => {
  test("call", async () => {
    const deepInfraChat = new ChatDeepInfra({ maxTokens: 20 });
    const message = new HumanMessage("1 + 1 = ");
    const res = await deepInfraChat.invoke([message]);
    console.log({ res });
  });

  test("generate", async () => {
    const deepInfraChat = new ChatDeepInfra({ maxTokens: 20 });
    const message = new HumanMessage("1 + 1 = ");
    const res = await deepInfraChat.generate([[message]]);
    console.log(JSON.stringify(res, null, 2));
  });
});
