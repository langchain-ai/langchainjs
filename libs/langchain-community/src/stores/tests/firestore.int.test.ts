import { test, expect } from "@jest/globals";

import { HumanMessage, AIMessage } from "@langchain/core/messages";
import admin from "firebase-admin";
import { FirestoreChatMessageHistory } from "../message/firestore.js";

const sessionId = Date.now().toString();

// firebase emulators:start --only firestore --project your-project-id
// FIRESTORE_EMULATOR_HOST="localhost:8080" pnpm test:single -- firestore.int.test.ts

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
    collections: ["langchain"],
    docs: ["langchain-doc-id"],
    sessionId,
    userId: "a@example.com",
    config: {
      projectId: "YOUR-PROJECT-ID",
      credential: admin.credential.cert({
        projectId: "YOUR-PROJECT-ID",
        privateKey:
          "-----BEGIN PRIVATE KEY-----\nnCHANGE-ME\n-----END PRIVATE KEY-----\n",
        clientEmail: "CHANGE-ME@CHANGE-ME-TOO.iam.gserviceaccount.com",
      }),
    },
  });

  expect(await messageHistory2.getMessages()).toEqual(expectedMessages);

  await messageHistory.clear();

  expect(await messageHistory.getMessages()).toEqual([]);
});

test.skip("Test firestore works with nested collections", async () => {
  const messageHistory = new FirestoreChatMessageHistory({
    collections: ["chats", "bots"],
    docs: ["chat-id", "bot-id"],
    sessionId: "user-id",
    userId: "a@example.com",
    config: {
      projectId: "YOUR-PROJECT-ID",
      credential: admin.credential.cert({
        projectId: "YOUR-PROJECT-ID",
        privateKey:
          "-----BEGIN PRIVATE KEY-----\nnCHANGE-ME\n-----END PRIVATE KEY-----\n",
        clientEmail: "CHANGE-ME@CHANGE-ME-TOO.iam.gserviceaccount.com",
      }),
    },
  });

  const message = new HumanMessage(
    `My name's Jonas and the current time is ${new Date().toLocaleTimeString()}`
  );
  await messageHistory.addMessage(message);
  const gotMessages = await messageHistory.getMessages();
  expect(gotMessages).toEqual([message]);
  // clear the collection
  await messageHistory.clear();
  // verify that the collection is empty
  const messagesAfterClear = await messageHistory.getMessages();
  expect(messagesAfterClear).toEqual([]);
});

test.skip("Test firestore works with when only a list of one collection is passed.", async () => {
  const messageHistory = new FirestoreChatMessageHistory({
    collections: ["only-one"],
    sessionId: "user-id",
    userId: "a@example.com",
    config: {
      projectId: "YOUR-PROJECT-ID",
      credential: admin.credential.cert({
        projectId: "YOUR-PROJECT-ID",
        privateKey:
          "-----BEGIN PRIVATE KEY-----\nnCHANGE-ME\n-----END PRIVATE KEY-----\n",
        clientEmail: "CHANGE-ME@CHANGE-ME-TOO.iam.gserviceaccount.com",
      }),
    },
  });

  const message = new HumanMessage(
    `My name's Jonas and the current time is ${new Date().toLocaleTimeString()}`
  );
  await messageHistory.addMessage(message);
  const gotMessages = await messageHistory.getMessages();
  expect(gotMessages).toEqual([message]);
  // clear the collection
  await messageHistory.clear();
  // verify that the collection is empty
  const messagesAfterClear = await messageHistory.getMessages();
  expect(messagesAfterClear).toEqual([]);
});
