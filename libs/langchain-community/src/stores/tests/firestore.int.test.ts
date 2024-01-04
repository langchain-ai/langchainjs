/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";

import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { FirestoreChatMessageHistory } from "../message/firestore.js";

const sessionId = Date.now().toString();

// firebase emulators:start --only firestore --project your-project-id
// FIRESTORE_EMULATOR_HOST="localhost:8080" yarn test:single -- firestore.int.test.ts

test.skip("Test firestore message history store", async () => {
  const messageHistory = new FirestoreChatMessageHistory({
    collectionName: "langchain",
    sessionId,
    userId: "a@example.com",
    config: { projectId: "your-project-id" },
  });

  await messageHistory.addUserMessage("My name's Jonas");
  await messageHistory.addAIChatMessage("Nice to meet you, Jonas!");
  await messageHistory.addUserMessage("Nice to meet you too!");

  const expectedMessages = [
    new HumanMessage("My name's Jonas"),
    new AIMessage("Nice to meet you, Jonas!"),
    new HumanMessage("Nice to meet you too!"),
  ];

  expect(await messageHistory.getMessages()).toEqual(expectedMessages);

  const messageHistory2 = new FirestoreChatMessageHistory({
    collectionName: "langchain",
    sessionId,
    userId: "a@example.com",
    config: { projectId: "your-project-id" },
  });

  expect(await messageHistory2.getMessages()).toEqual(expectedMessages);

  await messageHistory.clear();

  expect(await messageHistory.getMessages()).toEqual([]);
});
