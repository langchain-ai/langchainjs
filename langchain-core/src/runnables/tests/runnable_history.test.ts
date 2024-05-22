import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
} from "../../messages/index.js";
import { RunnableLambda } from "../base.js";
import { RunnableConfig } from "../config.js";
import { RunnableWithMessageHistory } from "../history.js";
import {
  BaseChatMessageHistory,
  BaseListChatMessageHistory,
} from "../../chat_history.js";
import {
  FakeChatMessageHistory,
  FakeLLM,
  FakeListChatMessageHistory,
  FakeListChatModel,
  FakeStreamingLLM,
} from "../../utils/testing/index.js";
import { ChatPromptTemplate, MessagesPlaceholder } from "../../prompts/chat.js";
import { StringOutputParser } from "../../output_parsers/string.js";

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

test("Runnable with message history with a chat model", async () => {
  const runnable = new FakeListChatModel({
    responses: ["Hello world!"],
  });

  const getMessageHistory = await getGetSessionHistory();
  const withHistory = new RunnableWithMessageHistory({
    runnable,
    config: {},
    getMessageHistory,
  });
  const config: RunnableConfig = { configurable: { sessionId: "2" } };
  const output = await withHistory.invoke([new HumanMessage("hello")], config);
  expect(output.content).toBe("Hello world!");
  const stream = await withHistory.stream(
    [new HumanMessage("good bye")],
    config
  );
  const chunks = [];
  for await (const chunk of stream) {
    console.log(chunk);
    chunks.push(chunk);
  }
  expect(chunks.map((chunk) => chunk.content).join("")).toEqual("Hello world!");
  const sessionHistory = await getMessageHistory("2");
  expect(await sessionHistory.getMessages()).toEqual([
    new HumanMessage("hello"),
    new AIMessage("Hello world!"),
    new HumanMessage("good bye"),
    new AIMessageChunk("Hello world!"),
  ]);
});

test("Runnable with message history with a messages in, messages out chain", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "you are a robot"],
    ["placeholder", "{messages}"],
  ]);
  const model = new FakeListChatModel({
    responses: ["So long and thanks for the fish!!"],
  });
  const runnable = prompt.pipe(model);

  const getMessageHistory = await getGetSessionHistory();
  const withHistory = new RunnableWithMessageHistory({
    runnable,
    config: {},
    getMessageHistory,
  });
  const config: RunnableConfig = { configurable: { sessionId: "2" } };
  const output = await withHistory.invoke([new HumanMessage("hello")], config);
  expect(output.content).toBe("So long and thanks for the fish!!");
  const stream = await withHistory.stream(
    [new HumanMessage("good bye")],
    config
  );
  const chunks = [];
  for await (const chunk of stream) {
    console.log(chunk);
    chunks.push(chunk);
  }
  expect(chunks.map((chunk) => chunk.content).join("")).toEqual(
    "So long and thanks for the fish!!"
  );
  const sessionHistory = await getMessageHistory("2");
  expect(await sessionHistory.getMessages()).toEqual([
    new HumanMessage("hello"),
    new AIMessage("So long and thanks for the fish!!"),
    new HumanMessage("good bye"),
    new AIMessageChunk("So long and thanks for the fish!!"),
  ]);
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
  const config: RunnableConfig = { configurable: { sessionId: "3" } };
  let output = await withHistory.invoke([new HumanMessage("hello")], config);
  expect(output).toBe("you said: hello");
  output = await withHistory.invoke([new HumanMessage("good bye")], config);
  expect(output).toBe("you said: hello\ngood bye");
});

test("Runnable with message history and RunnableSequence", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["ai", "You are a helpful assistant"],
    new MessagesPlaceholder("history"),
    ["human", "{input}"],
  ]);
  const model = new FakeLLM({});
  const chain = prompt.pipe(model);

  const getListMessageHistory = await getListSessionHistory();
  const withHistory = new RunnableWithMessageHistory({
    runnable: chain,
    config: {},
    getMessageHistory: getListMessageHistory,
    inputMessagesKey: "input",
    historyMessagesKey: "history",
  });
  const config: RunnableConfig = { configurable: { sessionId: "4" } };
  let output = await withHistory.invoke({ input: "hello" }, config);
  expect(output).toBe("AI: You are a helpful assistant\nHuman: hello");
  output = await withHistory.invoke({ input: "good bye" }, config);
  expect(output).toBe(`AI: You are a helpful assistant
Human: hello
AI: AI: You are a helpful assistant
Human: hello
Human: good bye`);
});

test("Runnable with message history should stream through", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["ai", "You are a helpful assistant"],
    new MessagesPlaceholder("history"),
    ["human", "{input}"],
  ]);
  const model = new FakeStreamingLLM({});
  const chain = prompt.pipe(model);

  const getListMessageHistory = await getListSessionHistory();
  const withHistory = new RunnableWithMessageHistory({
    runnable: chain,
    config: {},
    getMessageHistory: getListMessageHistory,
    inputMessagesKey: "input",
    historyMessagesKey: "history",
  }).pipe(new StringOutputParser());
  const config: RunnableConfig = { configurable: { sessionId: "5" } };
  const stream = await withHistory.stream({ input: "hello" }, config);
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
});
