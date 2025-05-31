import { describe, expect, it, test } from "@jest/globals";
import { v4 } from "uuid";
import { AIMessage, AIMessageChunk } from "../ai.js";
import { BaseMessage, MessageContent } from "../base.js";
import { ChatMessage } from "../chat.js";
import { HumanMessage } from "../human.js";
import { SystemMessage } from "../system.js";
import { ToolMessage } from "../tool.js";
import {
  filterMessages,
  mergeMessageRuns,
  trimMessages,
} from "../transformers.js";
import {
  getBufferString,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "../utils.js";

describe("filterMessage", () => {
  const getMessages = () => [
    new SystemMessage("you're a good assistant."),
    new HumanMessage({
      content: "what's your name",
      id: "foo",
      name: "example_user",
    }),
    new AIMessage({ content: "steve-o", id: "bar", name: "example_assistant" }),
    new HumanMessage({ content: "what's your favorite color", id: "baz" }),
    new AIMessage({ content: "silicon blue", id: "blah" }),
  ];

  it("works", () => {
    const messages = getMessages();
    const filteredMessages = filterMessages(messages, {
      includeNames: ["example_user", "example_assistant"],
      includeTypes: ["system"],
      excludeIds: ["bar"],
    });
    expect(filteredMessages).toEqual([
      new SystemMessage("you're a good assistant."),
      new HumanMessage({
        content: "what's your name",
        id: "foo",
        name: "example_user",
      }),
    ]);
  });

  it("can filter messages based on class types", () => {
    const messages = getMessages();

    const filteredMessages = filterMessages(messages, {
      includeTypes: [HumanMessage, AIMessage],
    });
    expect(filteredMessages).toHaveLength(4);
    expect(filteredMessages).toEqual([
      new HumanMessage({
        content: "what's your name",
        id: "foo",
        name: "example_user",
      }),
      new AIMessage({
        content: "steve-o",
        id: "bar",
        name: "example_assistant",
      }),
      new HumanMessage({ content: "what's your favorite color", id: "baz" }),
      new AIMessage({ content: "silicon blue", id: "blah" }),
    ]);
  });

  it("returns a runnable if no messages are passed", () => {
    const filteredMessagesRunnable = filterMessages();
    expect(filteredMessagesRunnable).toBeDefined();
    expect(filteredMessagesRunnable.lc_namespace).toEqual([
      "langchain_core",
      "runnables",
    ]);
    expect("func" in filteredMessagesRunnable).toBeTruthy();
    // `func` is protected, so we need to cast it to any to access it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(typeof (filteredMessagesRunnable as any).func).toBe("function");
  });
});

describe("mergeMessageRuns", () => {
  const getMessages = () => [
    new SystemMessage("you're a good assistant."),
    new HumanMessage({ content: "what's your favorite color", id: "foo" }),
    new HumanMessage({ content: "wait your favorite food", id: "bar" }),
    new AIMessage({
      content: "my favorite colo",
      tool_calls: [{ name: "blah_tool", args: { x: 2 }, id: "123" }],
      id: "baz",
    }),
    new AIMessage({
      content: [{ type: "text", text: "my favorite dish is lasagna" }],
      tool_calls: [{ name: "blah_tool", args: { x: -10 }, id: "456" }],
      id: "blur",
    }),
  ];

  it("works", () => {
    const messages = getMessages();

    const mergedMessages = mergeMessageRuns(messages);
    expect(mergedMessages).toHaveLength(3);
    expect(mergedMessages).toEqual([
      new SystemMessage("you're a good assistant."),
      new HumanMessage({
        content: "what's your favorite color\nwait your favorite food",
        id: "foo",
      }),
      new AIMessage({
        content: [
          { type: "text", text: "my favorite colo" },
          { type: "text", text: "my favorite dish is lasagna" },
        ],
        tool_calls: [
          { name: "blah_tool", args: { x: 2 }, id: "123", type: "tool_call" },
          { name: "blah_tool", args: { x: -10 }, id: "456", type: "tool_call" },
        ],
        id: "baz",
      }),
    ]);
  });

  it("returns a runnable if no messages are passed", () => {
    const mergedMessages = mergeMessageRuns();
    expect(mergedMessages).toBeDefined();
    expect(mergedMessages.lc_namespace).toEqual([
      "langchain_core",
      "runnables",
    ]);
    expect("func" in mergedMessages).toBeTruthy();
    // `func` is protected, so we need to cast it to any to access it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(typeof (mergedMessages as any).func).toBe("function");
  });
});

describe("trimMessages can trim", () => {
  const defaultCountTokensByMessageContent = (
    content: MessageContent
  ): number => {
    // treat each message like it adds 3 default tokens at the beginning
    // of the message and at the end of the message. 3 + 4 + 3 = 10 tokens
    // per message.
    const defaultMsgPrefixLen = 3;
    const defaultContentLen = 4;
    const defaultMsgSuffixLen = 3;

    const contentLen = Array.isArray(content)
      ? content.length * defaultContentLen
      : defaultContentLen;

    return defaultMsgPrefixLen + contentLen + defaultMsgSuffixLen;
  };

  const messagesAndTokenCounterFactory = ({
    countTokensByMessageContent = defaultCountTokensByMessageContent,
  } = {}) => {
    const messages = [
      new SystemMessage(
        "This is a 4 token text. The full message is 10 tokens."
      ),
      new HumanMessage({
        content: "This is a 4 token text. The full message is 10 tokens.",
        id: "first",
      }),
      new AIMessage({
        content: [
          { type: "text", text: "This is the FIRST 4 token block." },
          { type: "text", text: "This is the SECOND 4 token block." },
        ],
        id: "second",
      }),
      new HumanMessage({
        content: "This is a 4 token text. The full message is 10 tokens.",
        id: "third",
      }),
      new AIMessage({
        content: "This is a 4 token text. The full message is 10 tokens.",
        id: "fourth",
      }),
    ];

    const dummyTokenCounter = (messages: BaseMessage[]): number => {
      const count = messages.reduce(
        (count, msg) => count + countTokensByMessageContent(msg.content),
        0
      );
      console.log(count);
      return count;
    };

    return {
      messages,
      dummyTokenCounter,
    };
  };

  it("should not mutate messages", async () => {
    const messages: BaseMessage[] = [
      new HumanMessage({
        content: `My name is Jane Doe.
          this is a long text
          `,
        id: v4(),
      }),
      new HumanMessage({
        content: `My name is Jane Doe.feiowfjoaejfioewaijof ewoif ioawej foiaew iofewi ao
          this is a longer text than the first text.
          `,
        id: v4(),
      }),
    ];

    const repr = JSON.stringify(messages);

    await trimMessages(messages, {
      maxTokens: 14,
      strategy: "last",
      tokenCounter: () => 100,
      allowPartial: true,
    });

    expect(repr).toEqual(JSON.stringify(messages));
  });

  it("should not mutate messages if no trimming occurs with strategy last", async () => {
    const trimmer = trimMessages({
      maxTokens: 128000,
      strategy: "last",
      startOn: [HumanMessage],
      endOn: [AIMessage, ToolMessage],
      tokenCounter: () => 1,
    });
    const messages = [
      new HumanMessage({
        content: "Fetch the last 5 emails from Flora Testington's inbox.",
        additional_kwargs: {},
        response_metadata: {},
        id: undefined,
        name: undefined,
      }),
      new AIMessageChunk({
        id: "chatcmpl-abcdefg",
        content: "",
        additional_kwargs: {
          tool_calls: [
            {
              function: {
                name: "getEmails",
                arguments: JSON.stringify({
                  inboxName: "flora@foo.org",
                  amount: 5,
                  folder: "Inbox",
                  searchString: null,
                  from: null,
                  subject: null,
                }),
              },
              id: "foobarbaz",
              index: 0,
              type: "function",
            },
          ],
        },
        response_metadata: {
          usage: {},
        },
        tool_calls: [
          {
            name: "getEmails",
            args: {
              inboxName: "flora@foo.org",
              amount: 5,
              folder: "Inbox",
              searchString: null,
              from: null,
              subject: null,
            },
            id: "foobarbaz",
            type: "tool_call",
          },
        ],
        tool_call_chunks: [
          {
            name: "getEmails",
            args: '{"inboxName":"flora@foo.org","amount":5,"folder":"Inbox","searchString":null,"from":null,"subject":null,"cc":[],"bcc":[]}',
            id: "foobarbaz",
            type: "tool_call_chunk",
          },
        ],
        invalid_tool_calls: [],
        name: undefined,
      }),
      new ToolMessage({
        content: "a whole bunch of emails!",
        name: "getEmails",
        additional_kwargs: {},
        response_metadata: {},
        tool_call_id: "foobarbaz",
        artifact: undefined,
        id: undefined,
        status: undefined,
      }),
    ];
    const trimmedMessages = await trimmer.invoke(messages);
    expect(trimmedMessages).toEqual(messages);
  });

  it("First 30 tokens, not allowing partial messages", async () => {
    const { messages, dummyTokenCounter } = messagesAndTokenCounterFactory();
    const trimmedMessages = await trimMessages(messages, {
      maxTokens: 30,
      tokenCounter: dummyTokenCounter,
      strategy: "first",
    });
    expect(trimmedMessages).toHaveLength(2);
    expect(trimmedMessages).toEqual([
      new SystemMessage(
        "This is a 4 token text. The full message is 10 tokens."
      ),
      new HumanMessage({
        content: "This is a 4 token text. The full message is 10 tokens.",
        id: "first",
      }),
    ]);
  });

  it("First 30 tokens, allowing partial messages", async () => {
    const { messages, dummyTokenCounter } = messagesAndTokenCounterFactory();
    const trimmedMessages = await trimMessages(messages, {
      maxTokens: 30,
      tokenCounter: dummyTokenCounter,
      strategy: "first",
      allowPartial: true,
    });

    expect(trimmedMessages).toHaveLength(3);
    expect(trimmedMessages).toEqual([
      new SystemMessage(
        "This is a 4 token text. The full message is 10 tokens."
      ),
      new HumanMessage({
        content: "This is a 4 token text. The full message is 10 tokens.",
        id: "first",
      }),
      new AIMessage({
        content: [{ type: "text", text: "This is the FIRST 4 token block." }],
        id: "second",
      }),
    ]);
  });

  it("First 30 tokens, allowing partial messages, have to end on HumanMessage", async () => {
    const { messages, dummyTokenCounter } = messagesAndTokenCounterFactory();
    const trimmedMessages = await trimMessages(messages, {
      maxTokens: 30,
      tokenCounter: dummyTokenCounter,
      strategy: "first",
      allowPartial: true,
      endOn: "human",
    });

    expect(trimmedMessages).toHaveLength(2);
    expect(trimmedMessages).toEqual([
      new SystemMessage(
        "This is a 4 token text. The full message is 10 tokens."
      ),
      new HumanMessage({
        content: "This is a 4 token text. The full message is 10 tokens.",
        id: "first",
      }),
    ]);
  });

  it("First tokens, allowing partial messages, have to trim the last 10 characters of the last message", async () => {
    // For the purpose of this test, we'll override the dummy token counter to count characters.
    const { messages, dummyTokenCounter } = messagesAndTokenCounterFactory({
      countTokensByMessageContent: (content: MessageContent): number =>
        content.length,
    });

    const totalCharacters = messages.reduce(
      (count, msg) => count + msg.content.length,
      0
    );

    const trimmedMessages = await trimMessages(messages, {
      maxTokens: totalCharacters - 10,
      tokenCounter: dummyTokenCounter,
      strategy: "first",
      allowPartial: true,
      textSplitter: (text: string) => text.split(""),
    });

    const trimmedMessagesContent = trimmedMessages.map((msg) => msg.content);
    expect(trimmedMessagesContent).toEqual([
      "This is a 4 token text. The full message is 10 tokens.",
      "This is a 4 token text. The full message is 10 tokens.",
      [
        { type: "text", text: "This is the FIRST 4 token block." },
        { type: "text", text: "This is the SECOND 4 token block." },
      ],
      "This is a 4 token text. The full message is 10 tokens.",
      "This is a 4 token text. The full message is ",
    ]);
  });

  it("Last 30 tokens, including system message, not allowing partial messages", async () => {
    const { messages, dummyTokenCounter } = messagesAndTokenCounterFactory();
    const trimmedMessages = await trimMessages(messages, {
      maxTokens: 30,
      includeSystem: true,
      tokenCounter: dummyTokenCounter,
      strategy: "last",
    });

    expect(trimmedMessages).toHaveLength(3);
    expect(trimmedMessages).toEqual([
      new SystemMessage(
        "This is a 4 token text. The full message is 10 tokens."
      ),
      new HumanMessage({
        content: "This is a 4 token text. The full message is 10 tokens.",
        id: "third",
      }),
      new AIMessage({
        content: "This is a 4 token text. The full message is 10 tokens.",
        id: "fourth",
      }),
    ]);
  });

  it("Last 40 tokens, including system message, allowing partial messages", async () => {
    const { messages, dummyTokenCounter } = messagesAndTokenCounterFactory();
    const trimmedMessages = await trimMessages(messages, {
      maxTokens: 40,
      tokenCounter: dummyTokenCounter,
      strategy: "last",
      allowPartial: true,
      includeSystem: true,
    });

    expect(trimmedMessages).toHaveLength(4);
    expect(trimmedMessages).toEqual([
      new SystemMessage(
        "This is a 4 token text. The full message is 10 tokens."
      ),
      new AIMessage({
        content: [{ type: "text", text: "This is the FIRST 4 token block." }],
        id: "second",
      }),
      new HumanMessage({
        content: "This is a 4 token text. The full message is 10 tokens.",
        id: "third",
      }),
      new AIMessage({
        content: "This is a 4 token text. The full message is 10 tokens.",
        id: "fourth",
      }),
    ]);
  });

  it("Last 30 tokens, including system message, allowing partial messages, end on HumanMessage", async () => {
    const { messages, dummyTokenCounter } = messagesAndTokenCounterFactory();
    console.log(messages);
    const trimmedMessages = await trimMessages(messages, {
      maxTokens: 30,
      tokenCounter: dummyTokenCounter,
      strategy: "last",
      endOn: "human",
      includeSystem: true,
      allowPartial: true,
    });

    expect(trimmedMessages).toHaveLength(3);
    expect(trimmedMessages).toEqual([
      new SystemMessage(
        "This is a 4 token text. The full message is 10 tokens."
      ),
      new AIMessage({
        content: [{ type: "text", text: "This is the FIRST 4 token block." }],
        id: "second",
      }),
      new HumanMessage({
        content: "This is a 4 token text. The full message is 10 tokens.",
        id: "third",
      }),
    ]);
  });

  it("Last 40 tokens, including system message, allowing partial messages, start on HumanMessage", async () => {
    const { messages, dummyTokenCounter } = messagesAndTokenCounterFactory();
    const trimmedMessages = await trimMessages(messages, {
      maxTokens: 40,
      tokenCounter: dummyTokenCounter,
      strategy: "last",
      includeSystem: true,
      allowPartial: true,
      startOn: "human",
    });

    expect(trimmedMessages).toHaveLength(3);
    console.log(trimmedMessages);
    expect(trimmedMessages).toEqual([
      new SystemMessage(
        "This is a 4 token text. The full message is 10 tokens."
      ),
      new HumanMessage({
        content: "This is a 4 token text. The full message is 10 tokens.",
        id: "third",
      }),
      new AIMessage({
        content: "This is a 4 token text. The full message is 10 tokens.",
        id: "fourth",
      }),
    ]);
  });

  it("can filter (startOn) with message classes", async () => {
    const { messages, dummyTokenCounter } = messagesAndTokenCounterFactory();
    const trimmedMessages = await trimMessages(messages, {
      maxTokens: 40,
      tokenCounter: dummyTokenCounter,
      startOn: [HumanMessage],
    });
    expect(trimmedMessages).toHaveLength(2);
    expect(trimmedMessages).toEqual([
      new HumanMessage({
        content: "This is a 4 token text. The full message is 10 tokens.",
        id: "third",
      }),
      new AIMessage({
        content: "This is a 4 token text. The full message is 10 tokens.",
        id: "fourth",
      }),
    ]);
  });

  it("can filter (endOn) with message classes", async () => {
    const { messages, dummyTokenCounter } = messagesAndTokenCounterFactory();
    const trimmedMessages = await trimMessages(messages, {
      maxTokens: 40,
      tokenCounter: dummyTokenCounter,
      endOn: [HumanMessage],
    });
    console.log(trimmedMessages);
    expect(trimmedMessages).toHaveLength(3);
    expect(trimmedMessages).toEqual([
      new HumanMessage({
        content: "This is a 4 token text. The full message is 10 tokens.",
        id: "first",
      }),
      new AIMessage({
        content: [
          { type: "text", text: "This is the FIRST 4 token block." },
          { type: "text", text: "This is the SECOND 4 token block." },
        ],
        id: "second",
      }),
      new HumanMessage({
        content: "This is a 4 token text. The full message is 10 tokens.",
        id: "third",
      }),
    ]);
  });

  it("can return a runnable if empty array is passed", () => {
    const { dummyTokenCounter } = messagesAndTokenCounterFactory();
    const trimmedMessages = trimMessages({
      maxTokens: 40,
      tokenCounter: dummyTokenCounter,
    });
    expect(trimmedMessages).toBeDefined();
    expect(trimmedMessages.lc_namespace).toEqual([
      "langchain_core",
      "runnables",
    ]);
    expect("bound" in trimmedMessages).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect("func" in (trimmedMessages as any).bound).toBeTruthy();
    // `func` is protected, so we need to cast it to any to access it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(typeof (trimmedMessages as any).bound.func).toBe("function");
  });
});

test("getBufferString can handle complex messages", () => {
  const messageArr1 = [new HumanMessage("Hello there!")];
  const messageArr2 = [
    new AIMessage({
      content: [
        {
          type: "text",
          text: "Hello there!",
        },
      ],
    }),
  ];
  const messageArr3 = [
    new HumanMessage({
      content: [
        {
          type: "image_url",
          image_url: {
            url: "https://example.com/image.jpg",
          },
        },
        {
          type: "image_url",
          image_url: "https://example.com/image.jpg",
        },
      ],
    }),
  ];

  const bufferString1 = getBufferString(messageArr1);
  expect(bufferString1).toBe("Human: Hello there!");

  const bufferString2 = getBufferString(messageArr2);
  expect(bufferString2).toBe(
    `AI: ${JSON.stringify(
      [
        {
          type: "text",
          text: "Hello there!",
        },
      ],
      null,
      2
    )}`
  );

  const bufferString3 = getBufferString(messageArr3);
  expect(bufferString3).toBe(
    `Human: ${JSON.stringify(
      [
        {
          type: "image_url",
          image_url: {
            url: "https://example.com/image.jpg",
          },
        },
        {
          type: "image_url",
          image_url: "https://example.com/image.jpg",
        },
      ],
      null,
      2
    )}`
  );
});

describe("chat message conversions", () => {
  it("can convert a chat message to a stored message and back", () => {
    const originalMessages = [
      new ChatMessage("I'm a generic message!", "human"),
      new HumanMessage("I'm a human message!"),
    ];

    const storedMessages = mapChatMessagesToStoredMessages(originalMessages);

    const convertedBackMessages =
      mapStoredMessagesToChatMessages(storedMessages);

    expect(convertedBackMessages).toEqual(originalMessages);
  });
});
