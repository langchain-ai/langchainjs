import { test, expect } from "vitest";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import {
  convertOllamaMessagesToLangChain,
  convertToOllamaMessages,
} from "../utils.js";

test("convertOllamaMessagesToLangChain separates thinking into reasoning_content", () => {
  const msg = {
    role: "assistant",
    content: "Hello! How can I help?",
    thinking: "We should respond politely.",
  } as unknown as Parameters<typeof convertOllamaMessagesToLangChain>[0];

  const chunk = convertOllamaMessagesToLangChain(msg);

  expect(typeof chunk.content === "string" ? chunk.content : "").toBe(
    "Hello! How can I help?"
  );
  expect(chunk.additional_kwargs?.reasoning_content).toBe(
    "We should respond politely."
  );
});

test("convertToOllamaMessages preserves tool_calls when AIMessage content is a string", () => {
  const aiMsg = new AIMessage({
    content: "I'll look that up for you.",
    tool_calls: [
      {
        id: "call_123",
        name: "get_weather",
        args: { location: "San Francisco" },
      },
    ],
  });

  const result = convertToOllamaMessages([aiMsg]);

  const toolCallMsg = result.find(
    (m) => m.tool_calls && m.tool_calls.length > 0
  );
  expect(toolCallMsg).toBeDefined();
  expect(toolCallMsg!.content).toBe("I'll look that up for you.");
  expect(toolCallMsg!.tool_calls![0].id).toBe("call_123");
  expect(toolCallMsg!.tool_calls![0].type).toBe("function");
  expect(toolCallMsg!.tool_calls![0].function.name).toBe("get_weather");
  expect(toolCallMsg!.tool_calls![0].function.arguments).toEqual({
    location: "San Francisco",
  });
});

test("convertToOllamaMessages preserves tool_calls when AIMessage content is empty string", () => {
  const aiMsg = new AIMessage({
    content: "",
    tool_calls: [
      {
        id: "call_456",
        name: "search",
        args: { query: "test" },
      },
    ],
  });

  const result = convertToOllamaMessages([aiMsg]);

  expect(result).toHaveLength(1);
  expect(result[0].content).toBe("");
  expect(result[0].tool_calls).toBeDefined();
  expect(result[0].tool_calls![0].function.name).toBe("search");
});

test("convertToOllamaMessages returns string content for AIMessage without tool_calls", () => {
  const aiMsg = new AIMessage({
    content: "Hello!",
  });

  const result = convertToOllamaMessages([aiMsg]);

  expect(result).toHaveLength(1);
  expect(result[0].content).toBe("Hello!");
  expect(result[0].tool_calls).toBeUndefined();
});

test("convertToOllamaMessages joins text blocks of a ToolMessage", () => {
  const toolMsg = new ToolMessage({
    tool_call_id: "call_1",
    content: [
      { type: "text", text: "First line." },
      { type: "text", text: "Second line." },
    ],
  });

  expect(convertToOllamaMessages([toolMsg])).toEqual([
    { role: "tool", content: "First line.\nSecond line." },
  ]);
});

test("convertToOllamaMessages sends ToolMessage images as Ollama images", () => {
  const toolMsg = new ToolMessage({
    tool_call_id: "call_1",
    content: [
      { type: "text", text: "Took a screenshot." },
      { type: "image", mimeType: "image/png", data: "aW1hZ2Ux" },
      { type: "image", url: "data:image/png;base64,aW1hZ2Uy" },
      {
        type: "image_url",
        image_url: { url: "data:image/png;base64,aW1hZ2Uz" },
      },
    ],
  });

  expect(convertToOllamaMessages([toolMsg])).toEqual([
    {
      role: "tool",
      content: "Took a screenshot.",
      images: ["aW1hZ2Ux", "aW1hZ2Uy", "aW1hZ2Uz"],
    },
  ]);
});

test("convertToOllamaMessages rejects ToolMessage images that are not inline data", () => {
  const toolMsg = new ToolMessage({
    tool_call_id: "call_1",
    content: [{ type: "image", url: "https://example.com/screenshot.png" }],
  });

  expect(() => convertToOllamaMessages([toolMsg])).toThrow(
    "Unsupported tool message content type: image"
  );
});
