import { describe, test, expect } from "@jest/globals";
import { ChatMessage, HumanMessage } from "@langchain/core/messages";
import { ChatPrem } from "../premai.js";

describe.skip("ChatPrem", () => {
  test("invoke", async () => {
    const chat = new ChatPrem();
    const message = new HumanMessage("What color is the sky?");
    const res = await chat.invoke([message]);
    expect(res.content.length).toBeGreaterThan(10);
  });

  test("generate", async () => {
    const chat = new ChatPrem();
    const message = new HumanMessage("Hello!");
    const res = await chat.generate([[message]]);
    // console.log(JSON.stringify(res, null, 2));
    expect(res.generations[0][0].text.length).toBeGreaterThan(10);
  });

  test("custom messages", async () => {
    const chat = new ChatPrem();
    const res = await chat.invoke([new ChatMessage("Hello!", "user")]);
    // console.log({ res });
    expect(res.content.length).toBeGreaterThan(10);
  });

  test("custom messages in streaming mode", async () => {
    const chat = new ChatPrem({ streaming: true });
    const res = await chat.invoke([new ChatMessage("Hello!", "user")]);
    // console.log({ res });
    expect(res.content.length).toBeGreaterThan(10);
  });

  test("streaming", async () => {
    const chat = new ChatPrem();
    const message = new HumanMessage("What color is the sky?");
    const stream = await chat.stream([message]);
    let iters = 0;
    let finalRes = "";
    for await (const chunk of stream) {
      iters += 1;
      finalRes += chunk.content;
    }
    // console.log({ finalRes, iters });
    expect(iters).toBeGreaterThan(1);
  });
});
