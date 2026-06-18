import { describe, test, expect } from "vitest";
import { StringOutputParser } from "../string.js";
import { AIMessage, BaseMessage, ContentBlock } from "../../messages/index.js";

describe("StringOutputParser", () => {
  test("string input", async () => {
    const msg = "hello";
    const parser = new StringOutputParser();
    const result = await parser.invoke(msg);
    expect(result).toEqual("hello");
  });

  test("BaseMessage string content", async () => {
    const msg: BaseMessage = new AIMessage({ content: "hello" });
    const parser = new StringOutputParser();
    const result = await parser.invoke(msg);
    expect(result).toEqual("hello");
  });

  test("BaseMessage complex text type", async () => {
    const parser = new StringOutputParser();
    const content: ContentBlock[] = [
      {
        type: "text",
        text: "hello",
      },
    ];
    const msg: BaseMessage = new AIMessage({
      content,
    });
    const result = await parser.invoke(msg);
    expect(result).toEqual("hello");
  });

  test("BaseMessage multiple complex text type", async () => {
    const parser = new StringOutputParser();
    const content: ContentBlock[] = [
      {
        type: "text",
        text: "hello",
      },
      {
        type: "text",
        text: "there",
      },
    ];
    const msg: BaseMessage = new AIMessage({
      content,
    });
    const result = await parser.invoke(msg);
    expect(result).toEqual("hellothere");
  });

  test("BaseMessage complex text and image type fails", async () => {
    const parser = new StringOutputParser();
    const content: ContentBlock[] = [
      {
        type: "text",
        text: "hello",
      },
      {
        type: "image_url",
        image_url: "https://example.com/example.png",
      },
    ];
    const msg: BaseMessage = new AIMessage({
      content,
    });
    await expect(async () => {
      await parser.invoke(msg);
    }).rejects.toThrowError();
  });
});

test("ignores reasoning blocks and returns only text", async () => {
  const parser = new StringOutputParser();

  const content: ContentBlock[] = [
    {
      type: "reasoning",
      reasoning: "internal reasoning",
    },
    {
      type: "text",
      text: "final answer",
    },
  ];

  const msg: BaseMessage = new AIMessage({ content });
  const result = await parser.invoke(msg);

  expect(result).toEqual("final answer");
});

test("ignores thinking blocks", async () => {
  const parser = new StringOutputParser();

  const content: ContentBlock[] = [
    {
      type: "thinking",
      thinking: "hidden thoughts",
    },
    {
      type: "text",
      text: "visible output",
    },
  ];

  const msg: BaseMessage = new AIMessage({ content });
  const result = await parser.invoke(msg);

  expect(result).toEqual("visible output");
});

test("ignores redacted_thinking blocks", async () => {
  const parser = new StringOutputParser();

  const content: ContentBlock[] = [
    {
      type: "redacted_thinking",
      redacted_thinking: "redacted",
    },
    {
      type: "text",
      text: "answer",
    },
  ];

  const msg: BaseMessage = new AIMessage({ content });
  const result = await parser.invoke(msg);

  expect(result).toEqual("answer");
});
