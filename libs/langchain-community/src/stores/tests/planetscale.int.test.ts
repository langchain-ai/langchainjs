import { test, expect } from "@jest/globals";

import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { PlanetScaleChatMessageHistory } from "../message/planetscale.js";

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
});
