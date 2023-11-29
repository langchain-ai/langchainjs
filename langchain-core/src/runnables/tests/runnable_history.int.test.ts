import { HumanMessage, isBaseMessage } from "../../messages/index.js";
import { RunnableLambda } from "../base.js";
import { RunnableConfig } from "../config.js";
import { RunnableWithMessageHistory } from "../history.js";
import {
  BaseChatMessageHistory,
  FakeChatMessageHistory,
} from "../../chat_history.js";

function getGetSessionHistory(): (sessionId: string) => BaseChatMessageHistory {
  const chatHistoryStore: { [key: string]: BaseChatMessageHistory } = {};

  function getSessionHistory(sessionId: string): BaseChatMessageHistory {
    if (!(sessionId in chatHistoryStore)) {
      chatHistoryStore[sessionId] = new FakeChatMessageHistory();
    }
    return chatHistoryStore[sessionId];
  }

  return getSessionHistory;
}

test("Runnable with message history", async () => {
  const runnable = new RunnableLambda({
    func: (messages: HumanMessage[]) =>
      `you said: ${messages
        .filter((m) => isBaseMessage(m))
        .map((m) => m.content)
        .join("\n")}`,
  });
  const getSessionHistory = getGetSessionHistory();
  const withHistory = new RunnableWithMessageHistory({
    runnable,
    bound: runnable,
    kwargs: {},
    config: {},
    getMessageHistory: getSessionHistory,
  });
  const config: RunnableConfig = { configurable: { session_id: "1" } };
  let output = await withHistory.invoke([new HumanMessage("hello")], config);
  expect(output).toBe("you said: hello");
  output = await withHistory.invoke([new HumanMessage("good bye")], config);
  expect(output).toBe("you said: hello\ngood bye");
});
