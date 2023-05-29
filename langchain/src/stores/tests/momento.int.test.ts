/* eslint-disable no-promise-executor-return */

/*
 * Note: to run this test, you must have a Momento auth token
 * in the environment variable MOMENTO_AUTH_TOKEN.
 * You can obtain one for free at https://gomomento.com.
 */

import {
  CacheClient,
  Configurations,
  CredentialProvider,
} from "@gomomento/sdk";
import { v4 } from "uuid";
import { MomentoChatMessageHistory } from "../message/momento.js";
import { AIChatMessage, HumanChatMessage } from "../../schema/index.js";

const client = new CacheClient({
  configuration: Configurations.Laptop.v1(),
  credentialProvider: CredentialProvider.fromEnvironmentVariable({
    environmentVariableName: "MOMENTO_AUTH_TOKEN",
  }),
  defaultTtlSeconds: 60,
});
const cacheName = `langchain-${v4()}`;

afterAll(async () => {
  await client.deleteCache(cacheName);
});

describe("Test Momento message history store", () => {
  it("should show an empty history when no messages have been added", async () => {
    const sessionId = v4();
    const messageHistory = await MomentoChatMessageHistory.fromProps({
      sessionId,
      cacheName,
      client,
    });
    const messages = await messageHistory.getMessages();
    expect(messages).toEqual([]);
  });

  it("should show a history with messages when messages have been added", async () => {
    const sessionId = v4();
    const messageHistory = await MomentoChatMessageHistory.fromProps({
      sessionId,
      cacheName,
      client,
    });
    await messageHistory.addUserMessage("My name's Jonas");
    await messageHistory.addAIChatMessage("Nice to meet you, Jonas!");
    await messageHistory.addUserMessage("Nice to meet you too!");

    const expectedMessages = [
      new HumanChatMessage("My name's Jonas"),
      new AIChatMessage("Nice to meet you, Jonas!"),
      new HumanChatMessage("Nice to meet you too!"),
    ];

    expect(await messageHistory.getMessages()).toEqual(expectedMessages);
  });

  it("should clear the history", async () => {
    const sessionId = v4();
    const messageHistory = await MomentoChatMessageHistory.fromProps({
      sessionId,
      cacheName,
      client,
    });
    await messageHistory.addUserMessage("My name's Jonas");
    await messageHistory.addAIChatMessage("Nice to meet you, Jonas!");
    await messageHistory.addUserMessage("Nice to meet you too!");

    const expectedMessages = [
      new HumanChatMessage("My name's Jonas"),
      new AIChatMessage("Nice to meet you, Jonas!"),
      new HumanChatMessage("Nice to meet you too!"),
    ];

    expect(await messageHistory.getMessages()).toEqual(expectedMessages);

    await messageHistory.clear();

    expect(await messageHistory.getMessages()).toEqual([]);
  });

  it("should expire when we pass a custom TTL", async () => {
    const sessionId = v4();
    const messageHistory = await MomentoChatMessageHistory.fromProps({
      sessionId,
      cacheName,
      client,
      sessionTtl: 10,
    });
    await messageHistory.addUserMessage("My name's Jonas");
    await messageHistory.addAIChatMessage("Nice to meet you, Jonas!");
    await messageHistory.addUserMessage("Nice to meet you too!");

    const expectedMessages = [
      new HumanChatMessage("My name's Jonas"),
      new AIChatMessage("Nice to meet you, Jonas!"),
      new HumanChatMessage("Nice to meet you too!"),
    ];

    expect(await messageHistory.getMessages()).toEqual(expectedMessages);

    await new Promise((resolve) => setTimeout(resolve, 10_000));

    expect(await messageHistory.getMessages()).toEqual([]);
  });
});
