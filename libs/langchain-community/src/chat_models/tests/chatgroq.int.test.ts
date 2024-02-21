import { describe, test } from "@jest/globals";
import { ChatMessage, HumanMessage } from "@langchain/core/messages";
import { ChatGroq } from "../groq.js";

describe.skip("ChatGroq", () => {
  test("invoke", async () => {
    const chat = new ChatGroq({
      maxRetries: 0,
    });
    const message = new HumanMessage("What color is the sky?");
    const res = await chat.invoke([message]);
    console.log({ res });
    expect(res.content.length).toBeGreaterThan(10);
  });

  test("generate", async () => {
    const chat = new ChatGroq();
    const message = new HumanMessage("Hello!");
    const res = await chat.generate([[message]]);
    console.log(JSON.stringify(res, null, 2));
    expect(res.generations[0][0].text.length).toBeGreaterThan(10);
  });

  test("custom messages", async () => {
    const chat = new ChatGroq();
    const res = await chat.invoke([new ChatMessage("Hello!", "user")]);
    console.log({ res });
    expect(res.content.length).toBeGreaterThan(10);
  });

  // From their API docs it appears you can pass functions through the messages field, test function calling
});
