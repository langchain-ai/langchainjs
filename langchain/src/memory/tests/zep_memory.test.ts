import { jest, expect, test } from "@jest/globals";
import { v4 as uuid } from "uuid";

import { NotFoundError, ZepClient } from "@getzep/zep-js";

import { ZepChatMessageHistory } from "../zep_memory.js";

// import { AIChatMessage, HumanChatMessage } from "../../schema/index.js";

jest.mock("@getzep/zep-js");
const sessionID = uuid();
const url = "http://localhost:8000";

let zepServerReachable = false;

beforeAll(async () => {
  const testZepClient = new ZepClient(url) as jest.Mocked<ZepClient>;
  try {
    zepServerReachable =  await testZepClient.init();
  } catch (error) {
    console.error("Unexpected Error:", error);
  }
});

beforeEach((done) => {
  setTimeout(done, 1000); // 1-second delay before each test case
});

test("ZepChatMessageHistory - addAIChatMessage, addUserChatMessage to Zep memory", async () => {

  if (!zepServerReachable) {
    console.log("Zep Server is not reachable, skipping test..");
    return;
  }

  const zepChatHistory = new ZepChatMessageHistory(sessionID, url);

  try {
    await zepChatHistory.addUserMessage("Who was Octavia Butler?");
    await zepChatHistory.addAIChatMessage("Octavia Estelle Butler (June 22, 1947 – "+
    "February 24, 2006) was an American science fiction author.");
    expect(true).toBe(true); // Success, as no error was thrown
  } catch (error) {
    expect(true).toBe(false); // Fail, as an error was thrown
  }
});

test("ZepChatMessageHistory - getMessages - should retrieve chat messages from Zep memory", async () => {

  const zepChatHistory = new ZepChatMessageHistory(sessionID, url);

  if (!zepServerReachable) {
    console.log("Zep Server is not reachable, skipping test..");
    return;
  }

  try {
    const messages = await zepChatHistory.getMessages();
    expect(messages.length).toBeGreaterThanOrEqual(1);
  }
  catch (error) {
    expect(true).toBe(false); // Fail, as an error was thrown
  }
});

test("ZepChatMessageHistory - Search - for chat messages in Zep memory", async () => {

  if (!zepServerReachable) {
    console.log("Zep Server is not reachable, skipping test..");
    return;
  }

  const query = "Octavia Butler";
  const limit = 3;
  const zepChatHistory = new ZepChatMessageHistory(sessionID, url);

  try {
    const results = await zepChatHistory.search(query, limit);
    expect(results.length).toBeGreaterThanOrEqual(1); // Adjust the expectation based on the actual response
  } catch (error) {
    if (error instanceof NotFoundError) {
      // Handle the case where the session is not found
      expect(error.message).toContain(`Session with ID ${sessionID} not found`);
    } else {
      expect(true).toBe(false); // Fail for other error types
    }
  }
});

test("ZepChatMessageHistory - clear - should clear the Zep memory for the current session", async () => {

  if (!zepServerReachable) {
    console.log("Zep Server is not reachable, skipping test..");
    return;
  }

  const zepChatHistory = new ZepChatMessageHistory(sessionID, url);

  try {
    const results = await zepChatHistory.clear();
    expect(results).toBeUndefined();
  } catch (error) {
    expect(error).toBeUndefined(); // Check if the error is undefined
  }
});
