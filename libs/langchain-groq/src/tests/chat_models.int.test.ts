import { describe, test } from "@jest/globals";
import { HumanMessage } from "@langchain/core/messages";
import { ChatGroq } from "../chat_models.js";

describe("ChatGroq", () => {
  test("invoke", async () => {
    const chat = new ChatGroq({
      maxRetries: 0,
    });
    const message = new HumanMessage("What color is the sky?");
    const res = await chat.invoke([message]);
    console.log({ res });
    expect(res.content.length).toBeGreaterThan(10);
  });

  test("invoke with stop sequence", async () => {
    const chat = new ChatGroq({
      maxRetries: 0,
    });
    const message = new HumanMessage("Count to ten.");
    const res = await chat.bind({ stop: ["5", "five"] }).invoke([message]);
    console.log({ res });
    expect((res.content as string).toLowerCase()).not.toContain("6");
    expect((res.content as string).toLowerCase()).not.toContain("six");
  });

  test("invoke should respect passed headers", async () => {
    const chat = new ChatGroq({
      maxRetries: 0,
    });
    const message = new HumanMessage("Count to ten.");
    await expect(async () => {
      await chat.invoke([message], {
        headers: { Authorization: "badbadbad" },
      });
    }).rejects.toThrowError();
  });

  test("stream should respect passed headers", async () => {
    const chat = new ChatGroq({
      maxRetries: 0,
    });
    const message = new HumanMessage("Count to ten.");
    await expect(async () => {
      await chat.stream([message], {
        headers: { Authorization: "badbadbad" },
      });
    }).rejects.toThrowError();
  });

  test("generate", async () => {
    const chat = new ChatGroq();
    const message = new HumanMessage("Hello!");
    const res = await chat.generate([[message]]);
    console.log(JSON.stringify(res, null, 2));
    expect(res.generations[0][0].text.length).toBeGreaterThan(10);
  });

  test("streaming", async () => {
    const chat = new ChatGroq();
    const message = new HumanMessage("What color is the sky?");
    const stream = await chat.stream([message]);
    let iters = 0;
    let finalRes = "";
    for await (const chunk of stream) {
      iters += 1;
      finalRes += chunk.content;
    }
    console.log({ finalRes, iters });
    expect(iters).toBeGreaterThan(1);
  });

  test("invoke with bound tools", async () => {
    const chat = new ChatGroq({
      maxRetries: 0,
    });
    const message = new HumanMessage("What is the current weather in Hawaii?");
    const res = await chat
      .bind({
        tools: [
          {
            type: "function",
            function: {
              name: "get_current_weather",
              description: "Get the current weather in a given location",
              parameters: {
                type: "object",
                properties: {
                  location: {
                    type: "string",
                    description: "The city and state, e.g. San Francisco, CA",
                  },
                  unit: { type: "string", enum: ["celsius", "fahrenheit"] },
                },
                required: ["location"],
              },
            },
          },
        ],
        tool_choice: "auto",
      })
      .invoke([message]);
    console.log(JSON.stringify(res));
    expect(res.additional_kwargs.tool_calls?.length).toBeGreaterThan(0);
  });

  test.skip("stream with bound tools - not supported yet!", async () => {
    const chat = new ChatGroq({
      maxRetries: 0,
    });
    const message = new HumanMessage("What is the current weather in Hawaii?");
    const stream = await chat
      .bind({
        tools: [
          {
            type: "function",
            function: {
              name: "get_current_weather",
              description: "Get the current weather in a given location",
              parameters: {
                type: "object",
                properties: {
                  location: {
                    type: "string",
                    description: "The city and state, e.g. San Francisco, CA",
                  },
                  unit: { type: "string", enum: ["celsius", "fahrenheit"] },
                },
                required: ["location"],
              },
            },
          },
        ],
        tool_choice: "auto",
      })
      .stream([message]);
    for await (const chunk of stream) {
      console.log(JSON.stringify(chunk));
    }
  });
});
