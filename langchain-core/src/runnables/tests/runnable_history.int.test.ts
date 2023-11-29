import { HumanMessage, isBaseMessage } from "../../messages/index.js";
import { RunnableLambda } from "../base.js";
import { RunnableConfig } from "../config.js";
import { RunnableWithMessageHistory } from "../history.js";
import {
  BaseChatMessageHistory,
  FakeChatMessageHistory,
} from "../../chat_history.js";

async function getGetSessionHistory(): Promise<
  (sessionId: string) => Promise<BaseChatMessageHistory>
> {
  const chatHistoryStore: { [key: string]: BaseChatMessageHistory } = {};

  async function getSessionHistory(
    sessionId: string
  ): Promise<BaseChatMessageHistory> {
    if (!(sessionId in chatHistoryStore)) {
      console.log("not in store");
      chatHistoryStore[sessionId] = new FakeChatMessageHistory();
    } else {
      console.log("in store", await chatHistoryStore[sessionId].getMessages());
    }
    return chatHistoryStore[sessionId];
  }

  return getSessionHistory;
}

test("Runnable with message history", async () => {
  const runnable = new RunnableLambda({
    func: (messages: HumanMessage[]) => {
      console.log("runnin", messages);
      const messagesArr: HumanMessage[] = !Array.isArray(messages)
        ? Object.values(messages)
        : messages;
      return `you said: ${messagesArr
        .filter((m) => isBaseMessage(m))
        .map((m) => m.content)
        .join("\n")}`;
    },
  });
  const getMessageHistory = await getGetSessionHistory();
  const withHistory = new RunnableWithMessageHistory({
    runnable,
    bound: runnable,
    kwargs: {},
    config: {},
    getMessageHistory,
  });
  const config: RunnableConfig = { configurable: { sessionId: "1" } };
  let output = await withHistory.invoke([new HumanMessage("hello")], config);
  expect(output).toBe("you said: hello");
  output = await withHistory.invoke([new HumanMessage("good bye")], config);
  expect(output).toBe("you said: hello\ngood bye");
});
