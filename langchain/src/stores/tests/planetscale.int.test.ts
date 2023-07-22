/* eslint-disable no-promise-executor-return */
/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { test, expect } from "@jest/globals";

import { PlanetScaleChatMessageHistory } from "../message/planetscale.js";
import { HumanMessage, AIMessage } from "../../schema/index.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { ConversationChain } from "../../chains/conversation.js";
import { BufferMemory } from "../../memory/buffer_memory.js";

const config = {
  url: process.env.PLANETSCALE_DATABASE_URL!,
};

describe("PlanetScaleChatMessageHistory", () => {
  test.skip("Test Planetscale history store", async () => {
    const chatHistory = new PlanetScaleChatMessageHistory({
      sessionId: new Date().toISOString(),
      config,
    });

    const blankResult = await chatHistory.getMessages();
    expect(blankResult).toStrictEqual([]);

    await chatHistory.addUserMessage("Who is the best vocalist?");
    await chatHistory.addAIChatMessage("Ozzy Osbourne");

    const expectedMessages = [
      new HumanMessage("Who is the best vocalist?"),
      new AIMessage("Ozzy Osbourne"),
    ];

    const resultWithHistory = await chatHistory.getMessages();
    expect(resultWithHistory).toEqual(expectedMessages);
  });

  test.skip("Test clear Planetscale history store", async () => {
    const chatHistory = new PlanetScaleChatMessageHistory({
      sessionId: new Date().toISOString(),
      config,
    });

    await chatHistory.addUserMessage("Who is the best vocalist?");
    await chatHistory.addAIChatMessage("Ozzy Osbourne");

    const expectedMessages = [
      new HumanMessage("Who is the best vocalist?"),
      new AIMessage("Ozzy Osbourne"),
    ];

    const resultWithHistory = await chatHistory.getMessages();
    expect(resultWithHistory).toEqual(expectedMessages);

    await chatHistory.clear();

    const blankResult = await chatHistory.getMessages();
    expect(blankResult).toStrictEqual([]);
  });

  test.skip("Test Planetscale memory with Buffer Memory", async () => {
    const memory = new BufferMemory({
      returnMessages: true,
      chatHistory: new PlanetScaleChatMessageHistory({
        sessionId: new Date().toISOString(),
        config,
      }),
    });

    await memory.saveContext(
      { input: "Who is the best vocalist?" },
      { response: "Ozzy Osbourne" }
    );

    const expectedHistory = [
      new HumanMessage("Who is the best vocalist?"),
      new AIMessage("Ozzy Osbourne"),
    ];

    const result2 = await memory.loadMemoryVariables({});
    expect(result2).toStrictEqual({ history: expectedHistory });
  });

  test.skip("Test Planetscale memory with LLM Chain", async () => {
    const memory = new BufferMemory({
      chatHistory: new PlanetScaleChatMessageHistory({
        sessionId: new Date().toISOString(),
        config,
      }),
    });

    const model = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0,
    });
    const chain = new ConversationChain({ llm: model, memory });

    const res1 = await chain.call({ input: "Hi! I'm Jim." });
    console.log({ res1 });

    const res2 = await chain.call({
      input: "What did I just say my name was?",
    });
    console.log({ res2 });

    expect(res2.response).toContain("Jim");
  });
});
