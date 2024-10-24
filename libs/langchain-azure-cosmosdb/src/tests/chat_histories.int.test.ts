/*  eslint-disable no-promise-executor-return  */

import { expect } from "@jest/globals";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { AzureCosmsosDBNoSQLChatMessageHistory } from "../chat_histories.js";


test("Test CosmosDB History Store", async () => {
    const input = {
        sessionId: new Date().toISOString(),
        userId: "abcde",
        databaseName: "TestDB1",
    }
    const chatHistory = new AzureCosmsosDBNoSQLChatMessageHistory(input)
    const blankResult = await chatHistory.getMessages();
    expect(blankResult).toStrictEqual([]);

    await chatHistory.addUserMessage("Who is the best vocalist?");
    await chatHistory.addAIMessage("Ozzy Osbourne");


    const expectedMessages = [
        new HumanMessage("Who is the best vocalist?"),
        new AIMessage("Ozzy Osbourne"),
    ];
    const resultWithHistory = await chatHistory.getMessages();
    expect(resultWithHistory).toEqual(expectedMessages);
})

test("Test clear CosmosDB history Store", async () => {
    const input = {
        sessionId: new Date().toISOString(),
        userId: "abcde",
        databaseName: "TestDB2",
    }
    const chatHistory = new AzureCosmsosDBNoSQLChatMessageHistory(input)

    await chatHistory.addUserMessage("Who is the best vocalist?");
    await chatHistory.addAIMessage("Ozzy Osbourne");


    const expectedMessages = [
        new HumanMessage("Who is the best vocalist?"),
        new AIMessage("Ozzy Osbourne"),
    ];
    const resultWithHistory = await chatHistory.getMessages();
    expect(resultWithHistory).toEqual(expectedMessages);

    await chatHistory.clear();

    const blankResult = await chatHistory.getMessages();
    expect(blankResult).toStrictEqual([]);

})





