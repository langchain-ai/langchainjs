import { test, expect } from "@jest/globals";
import { filterMessages, mergeMessageRuns, trimMessages } from "../utils.js";
import { AIMessage } from "../ai.js";
import { HumanMessage } from "../human.js";
import { SystemMessage } from "../system.js";
import { BaseMessage } from "../base.js";

test("filterMessages works", () => {
  const messages = [
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

test("mergeMessageRuns works", () => {
  const messages = [
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
        { name: "blah_tool", args: { x: 2 }, id: "123" },
        { name: "blah_tool", args: { x: -10 }, id: "456" },
      ],
      id: "baz",
    }),
  ]);
});

describe("trimMessages can trim", () => {
  const messages = [
    new SystemMessage("This is a 4 token text. The full message is 10 tokens."),
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

  function dummyTokenCounter(messages: BaseMessage[]): number {
    // treat each message like it adds 3 default tokens at the beginning
    // of the message and at the end of the message. 3 + 4 + 3 = 10 tokens
    // per message.

    const defaultContentLen = 4;
    const defaultMsgPrefixLen = 3;
    const defaultMsgSuffixLen = 3;

    let count = 0;
    for (const msg of messages) {
      if (typeof msg.content === "string") {
        count += defaultMsgPrefixLen + defaultContentLen + defaultMsgSuffixLen;
      }
      if (Array.isArray(msg.content)) {
        count +=
          defaultMsgPrefixLen +
          msg.content.length * defaultContentLen +
          defaultMsgSuffixLen;
      }
    }
    return count;
  }

  it("First 30 tokens, not allowing partial messages", async () => {
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

  it("Last 30 tokens, including system message, not allowing partial messages", async () => {
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
});
