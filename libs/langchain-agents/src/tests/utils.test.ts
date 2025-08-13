import { describe, it, expect } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { Send } from "@langchain/langgraph";

import {
  _addInlineAgentName,
  _removeInlineAgentName,
  isSend,
} from "../utils.js";

describe("_addInlineAgentName", () => {
  it("should return non-AI messages unchanged", () => {
    const humanMessage = new HumanMessage("Hello");
    const result = _addInlineAgentName(humanMessage);
    expect(result).toEqual(humanMessage);
  });

  it("should return AI messages with no name unchanged", () => {
    const aiMessage = new AIMessage("Hello world");
    const result = _addInlineAgentName(aiMessage);
    expect(result).toEqual(aiMessage);
  });

  it("should format AI messages with name and content tags", () => {
    const aiMessage = new AIMessage({
      content: "Hello world",
      name: "assistant",
    });
    const result = _addInlineAgentName(aiMessage);
    expect(result.content).toEqual(
      "<name>assistant</name><content>Hello world</content>"
    );
  });

  it("should handle content blocks correctly", () => {
    const contentBlocks = [
      { type: "text", text: "Hello world" },
      { type: "image", image_url: "http://example.com/image.jpg" },
    ];
    const aiMessage = new AIMessage({
      content: contentBlocks,
      name: "assistant",
    });
    const result = _addInlineAgentName(aiMessage);
    expect(result.content).toEqual([
      {
        type: "text",
        text: "<name>assistant</name><content>Hello world</content>",
      },
      { type: "image", image_url: "http://example.com/image.jpg" },
    ]);
  });

  it("should handle content blocks without text blocks", () => {
    const contentBlocks = [
      { type: "image", image_url: "http://example.com/image.jpg" },
      { type: "file", file_url: "http://example.com/document.pdf" },
    ];
    const expectedContentBlocks = [
      { type: "text", text: "<name>assistant</name><content></content>" },
      ...contentBlocks,
    ];
    const aiMessage = new AIMessage({
      content: contentBlocks,
      name: "assistant",
    });
    const result = _addInlineAgentName(aiMessage);
    expect(result.content).toEqual(expectedContentBlocks);
  });
});

describe("_removeInlineAgentName", () => {
  it("should return non-AI messages unchanged", () => {
    const humanMessage = new HumanMessage("Hello");
    const result = _removeInlineAgentName(humanMessage);
    expect(result).toEqual(humanMessage);
  });

  it("should return messages with empty content unchanged", () => {
    const aiMessage = new AIMessage({
      content: "",
      name: "assistant",
    });
    const result = _removeInlineAgentName(aiMessage);
    expect(result).toEqual(aiMessage);
  });

  it("should return messages without name/content tags unchanged", () => {
    const aiMessage = new AIMessage({
      content: "Hello world",
      name: "assistant",
    });
    const result = _removeInlineAgentName(aiMessage);
    expect(result).toEqual(aiMessage);
  });

  it("should correctly extract content from tags", () => {
    const aiMessage = new AIMessage({
      content: "<name>assistant</name><content>Hello world</content>",
      name: "assistant",
    });
    const result = _removeInlineAgentName(aiMessage);
    expect(result.content).toEqual("Hello world");
    expect(result.name).toEqual("assistant");
  });

  it("should handle content blocks correctly", () => {
    const contentBlocks = [
      {
        type: "text",
        text: "<name>assistant</name><content>Hello world</content>",
      },
      { type: "image", image_url: "http://example.com/image.jpg" },
    ];
    const aiMessage = new AIMessage({
      content: contentBlocks,
      name: "assistant",
    });
    const result = _removeInlineAgentName(aiMessage);

    const expectedContent = [
      { type: "text", text: "Hello world" },
      { type: "image", image_url: "http://example.com/image.jpg" },
    ];
    expect(result.content).toEqual(expectedContent);
    expect(result.name).toEqual("assistant");
  });

  it("should handle content blocks with empty text content", () => {
    const contentBlocks = [
      { type: "text", text: "<name>assistant</name><content></content>" },
      { type: "image", image_url: "http://example.com/image.jpg" },
      { type: "file", file_url: "http://example.com/document.pdf" },
    ];
    const expectedContentBlocks = contentBlocks.slice(1);
    const aiMessage = new AIMessage({
      content: contentBlocks,
      name: "assistant",
    });
    const result = _removeInlineAgentName(aiMessage);
    expect(result.content).toEqual(expectedContentBlocks);
  });

  it("should handle multiline content", () => {
    const multilineContent = `<name>assistant</name><content>This is
a multiline
message</content>`;
    const aiMessage = new AIMessage({
      content: multilineContent,
      name: "assistant",
    });
    const result = _removeInlineAgentName(aiMessage);
    expect(result.content).toEqual("This is\na multiline\nmessage");
  });
});

describe("isSend", () => {
  it("should return true for send objects", () => {
    const send = new Send("node", { foo: "bar" });
    expect(isSend(send)).toBe(true);
  });

  it("should return false for non-send objects", () => {
    const nonSend = {
      type: "human",
      content: "Hello",
    };
    expect(isSend(nonSend)).toBe(false);
  });
});
