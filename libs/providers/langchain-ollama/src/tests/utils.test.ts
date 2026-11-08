import { test, expect } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import {
  convertOllamaMessagesToLangChain,
  convertToOllamaMessages,
} from "../utils.js";

const IMAGE_BASE64 = "iVBORw0KGgo=";
const IMAGE_DATA_URL = `data:image/png;base64,${IMAGE_BASE64}`;
const IMAGE_BYTES = new Uint8Array([
  255, 137, 80, 78, 71, 13, 10, 26, 10, 255,
]).subarray(1, 9);

test.each([
  {
    name: "standard base64 image",
    block: { type: "image", data: IMAGE_BASE64, mimeType: "image/png" },
    image: IMAGE_BASE64,
  },
  {
    name: "standard binary image with a non-zero byte offset",
    block: { type: "image", data: IMAGE_BYTES, mimeType: "image/png" },
    image: IMAGE_BYTES,
  },
  {
    name: "standard data URL image",
    block: { type: "image", url: IMAGE_DATA_URL },
    image: IMAGE_BASE64,
  },
  {
    name: "legacy standard base64 image",
    block: {
      type: "image",
      source_type: "base64",
      data: IMAGE_BASE64,
      mime_type: "image/png",
    },
    image: IMAGE_BASE64,
  },
  {
    name: "legacy standard data URL image",
    block: { type: "image", source_type: "url", url: IMAGE_DATA_URL },
    image: IMAGE_BASE64,
  },
  {
    name: "image_url string",
    block: { type: "image_url", image_url: IMAGE_DATA_URL },
    image: IMAGE_BASE64,
  },
  {
    name: "image_url object",
    block: { type: "image_url", image_url: { url: IMAGE_DATA_URL } },
    image: IMAGE_BASE64,
  },
])("convertToOllamaMessages accepts $name", ({ block, image }) => {
  const message = new HumanMessage({
    content: [
      { type: "text", text: "Describe this image." },
      block,
      { type: "text", text: "Be concise." },
    ],
  });

  expect(convertToOllamaMessages([message])).toEqual([
    { role: "user", content: "Describe this image." },
    { role: "user", content: "", images: [image] },
    { role: "user", content: "Be concise." },
  ]);
});

test.each([
  { type: "image", url: "https://example.com/image.png" },
  { type: "image", url: "file:///image.png" },
  { type: "image", fileId: "image-123" },
  { type: "image", source_type: "id", id: "image-123" },
  { type: "image" },
  { type: "image", data: [137, 80, 78, 71] },
])("convertToOllamaMessages rejects unsupported image sources: %j", (block) => {
  expect(() =>
    convertToOllamaMessages([new HumanMessage({ content: [block] })])
  ).toThrow(/Ollama only supports images with base64 data or Uint8Array data/);
});

test("convertToOllamaMessages accepts images supplied through contentBlocks", () => {
  const message = new HumanMessage({
    contentBlocks: [
      { type: "text", text: "Compare these images." },
      { type: "image", data: IMAGE_BASE64, mimeType: "image/png" },
      { type: "image", data: IMAGE_BYTES, mimeType: "image/png" },
    ],
  });

  expect(convertToOllamaMessages([message])).toEqual([
    { role: "user", content: "Compare these images." },
    { role: "user", content: "", images: [IMAGE_BASE64] },
    { role: "user", content: "", images: [IMAGE_BYTES] },
  ]);
});

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
