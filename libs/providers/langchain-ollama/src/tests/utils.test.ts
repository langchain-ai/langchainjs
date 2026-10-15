import { test, expect } from "vitest";
import { AIMessage } from "@langchain/core/messages";
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

test("convertToOllamaMessages sends reasoning_content back as thinking", () => {
  const aiMsg = new AIMessage({
    content: "",
    additional_kwargs: { reasoning_content: "I should check the weather." },
    tool_calls: [
      {
        id: "call_789",
        name: "get_weather",
        args: { location: "Tehran" },
      },
    ],
  });

  const result = convertToOllamaMessages([aiMsg]);

  expect(result).toHaveLength(1);
  expect(result[0].thinking).toBe("I should check the weather.");
  expect(result[0].tool_calls![0].function.name).toBe("get_weather");
});

test("convertToOllamaMessages sends thinking for a final answer", () => {
  const aiMsg = new AIMessage({
    content: "It is sunny.",
    additional_kwargs: { reasoning_content: "The tool said sunny." },
  });

  const result = convertToOllamaMessages([aiMsg]);

  expect(result).toEqual([
    {
      role: "assistant",
      content: "It is sunny.",
      thinking: "The tool said sunny.",
    },
  ]);
});

test("convertToOllamaMessages sends thinking once for array content", () => {
  const aiMsg = new AIMessage({
    content: [
      { type: "text", text: "Let me look." },
      {
        type: "tool_use",
        id: "call_abc",
        name: "search",
        input: { query: "test" },
      },
    ],
    additional_kwargs: { reasoning_content: "I need to search." },
    tool_calls: [{ id: "call_abc", name: "search", args: { query: "test" } }],
  });

  const result = convertToOllamaMessages([aiMsg]);

  expect(result).toHaveLength(2);
  expect(result[0].content).toBe("Let me look.");
  expect(result[0].thinking).toBe("I need to search.");
  expect(result[1].tool_calls![0].function.name).toBe("search");
  expect(result[1].thinking).toBeUndefined();
});

test("convertToOllamaMessages omits thinking when there is no reasoning", () => {
  const aiMsg = new AIMessage({ content: "Hello!" });

  const result = convertToOllamaMessages([aiMsg]);

  expect(result[0]).not.toHaveProperty("thinking");
});
