import { BaseMessage, HumanMessage } from "../../messages/index.js";
import { RunnableLambda } from "../base.js";
import { RunnableConfig } from "../config.js";
import { RunnableWithMessageHistory } from "../history.js";
import {
  BaseChatMessageHistory,
  BaseListChatMessageHistory,
} from "../../chat_history.js";
import {
  FakeChatMessageHistory,
  FakeListChatMessageHistory,
} from "../../utils/testing/index.js";

// For `BaseChatMessageHistory`
async function getGetSessionHistory(): Promise<
  (sessionId: string) => Promise<BaseChatMessageHistory>
> {
  const chatHistoryStore: { [key: string]: BaseChatMessageHistory } = {};

  async function getSessionHistory(
    sessionId: string
  ): Promise<BaseChatMessageHistory> {
    if (!(sessionId in chatHistoryStore)) {
      chatHistoryStore[sessionId] = new FakeChatMessageHistory();
    }
    return chatHistoryStore[sessionId];
  }

  return getSessionHistory;
}

// Extends `BaseListChatMessageHistory`
async function getListSessionHistory(): Promise<
  (sessionId: string) => Promise<BaseListChatMessageHistory>
> {
  const chatHistoryStore: { [key: string]: BaseListChatMessageHistory } = {};

  async function getSessionHistory(
    sessionId: string
  ): Promise<BaseListChatMessageHistory> {
    if (!(sessionId in chatHistoryStore)) {
      chatHistoryStore[sessionId] = new FakeListChatMessageHistory();
    }
    return chatHistoryStore[sessionId];
  }

  return getSessionHistory;
}

test("Runnable with message history", async () => {
  const runnable = new RunnableLambda({
    func: (messages: BaseMessage[]) =>
      `you said: ${messages
        .filter((m) => m._getType() === "human")
        .map((m) => m.content)
        .join("\n")}`,
  });

  const getMessageHistory = await getGetSessionHistory();
  const withHistory = new RunnableWithMessageHistory({
    runnable,
    config: {},
    getMessageHistory,
  });
  const config: RunnableConfig = { configurable: { sessionId: "1" } };
  let output = await withHistory.invoke([new HumanMessage("hello")], config);
  expect(output).toBe("you said: hello");
  output = await withHistory.invoke([new HumanMessage("good bye")], config);
  expect(output).toBe("you said: hello\ngood bye");
});

test("Runnable with message history work with chat list memory", async () => {
  const runnable = new RunnableLambda({
    func: (messages: BaseMessage[]) =>
      `you said: ${messages
        .filter((m) => m._getType() === "human")
        .map((m) => m.content)
        .join("\n")}`,
  });

  const getListMessageHistory = await getListSessionHistory();
  const withHistory = new RunnableWithMessageHistory({
    runnable,
    config: {},
    getMessageHistory: getListMessageHistory,
  });
  const config: RunnableConfig = { configurable: { sessionId: "1" } };
  let output = await withHistory.invoke([new HumanMessage("hello")], config);
  expect(output).toBe("you said: hello");
  output = await withHistory.invoke([new HumanMessage("good bye")], config);
  expect(output).toBe("you said: hello\ngood bye");
});
