import { describe, test, expect } from "vitest";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { firstOfType, lastOfType, messagesOfType } from "../matchers.ts";

// -- Message type matchers --

describe("toBeHumanMessage", () => {
  test("passes with HumanMessage", () => {
    expect(new HumanMessage("hi")).toBeHumanMessage();
  });

  test("passes with matching content", () => {
    expect(new HumanMessage("hi")).toBeHumanMessage("hi");
  });

  test("fails with wrong type", () => {
    expect(() => expect(new AIMessage("hi")).toBeHumanMessage()).toThrow();
  });

  test("fails with wrong content", () => {
    expect(() =>
      expect(new HumanMessage("hi")).toBeHumanMessage("bye")
    ).toThrow();
  });
});

describe("toBeAIMessage", () => {
  test("passes with AIMessage", () => {
    expect(new AIMessage("hello")).toBeAIMessage();
  });

  test("passes with matching fields", () => {
    expect(new AIMessage({ content: "hello", name: "bot" })).toBeAIMessage({
      content: "hello",
      name: "bot",
    });
  });

  test("fails with wrong type", () => {
    expect(() => expect(new HumanMessage("hello")).toBeAIMessage()).toThrow();
  });
});

describe("toBeSystemMessage", () => {
  test("passes with SystemMessage", () => {
    expect(new SystemMessage("you are helpful")).toBeSystemMessage();
  });

  test("passes with matching content", () => {
    expect(new SystemMessage("you are helpful")).toBeSystemMessage(
      "you are helpful"
    );
  });

  test("fails with wrong type", () => {
    expect(() => expect(new AIMessage("nope")).toBeSystemMessage()).toThrow();
  });
});

describe("toBeToolMessage", () => {
  const toolMsg = new ToolMessage({
    content: "result",
    tool_call_id: "call_1",
  });

  test("passes with ToolMessage", () => {
    expect(toolMsg).toBeToolMessage();
  });

  test("passes with matching fields", () => {
    expect(toolMsg).toBeToolMessage({ tool_call_id: "call_1" });
  });

  test("fails with wrong type", () => {
    expect(() => expect(new HumanMessage("nope")).toBeToolMessage()).toThrow();
  });
});

// -- Tool call matchers --

const aiWithTools = new AIMessage({
  content: "",
  tool_calls: [
    { name: "search", id: "call_1", args: { query: "weather" } },
    { name: "calc", id: "call_2", args: { expr: "1+1" } },
  ],
});

describe("toHaveToolCalls", () => {
  test("passes when tool calls match", () => {
    expect(aiWithTools).toHaveToolCalls([{ name: "search" }, { name: "calc" }]);
  });

  test("fails on non-AIMessage", () => {
    expect(() => expect(new HumanMessage("hi")).toHaveToolCalls([])).toThrow();
  });

  test("fails on wrong count", () => {
    expect(() =>
      expect(aiWithTools).toHaveToolCalls([{ name: "search" }])
    ).toThrow();
  });
});

describe("toHaveToolCallCount", () => {
  test("passes with correct count", () => {
    expect(aiWithTools).toHaveToolCallCount(2);
  });

  test("fails with wrong count", () => {
    expect(() => expect(aiWithTools).toHaveToolCallCount(5)).toThrow();
  });
});

describe("toContainToolCall", () => {
  test("passes when matching tool call exists", () => {
    expect(aiWithTools).toContainToolCall({ name: "search" });
  });

  test("fails when no tool call matches", () => {
    expect(() =>
      expect(aiWithTools).toContainToolCall({ name: "nonexistent" })
    ).toThrow();
  });

  test("works with .not", () => {
    expect(aiWithTools).not.toContainToolCall({ name: "nonexistent" });
  });
});

// -- Tool message list matcher --

describe("toHaveToolMessages", () => {
  const messages = [
    new HumanMessage("hi"),
    new AIMessage("calling tool"),
    new ToolMessage({ content: "result1", tool_call_id: "c1" }),
    new ToolMessage({ content: "result2", tool_call_id: "c2" }),
  ];

  test("passes when tool messages match", () => {
    expect(messages).toHaveToolMessages([
      { content: "result1" },
      { content: "result2" },
    ]);
  });

  test("fails on non-array", () => {
    expect(() => expect("not an array").toHaveToolMessages([])).toThrow();
  });

  test("fails on count mismatch", () => {
    expect(() =>
      expect(messages).toHaveToolMessages([{ content: "result1" }])
    ).toThrow();
  });
});

// -- Interrupt matcher --

describe("toHaveBeenInterrupted", () => {
  test("passes with __interrupt__ present", () => {
    expect({ __interrupt__: [{ value: "pause" }] }).toHaveBeenInterrupted();
  });

  test("passes with matching interrupt value", () => {
    expect({ __interrupt__: [{ value: "pause" }] }).toHaveBeenInterrupted(
      "pause"
    );
  });

  test("fails without __interrupt__", () => {
    expect(() => expect({}).toHaveBeenInterrupted()).toThrow();
  });
});

// -- Structured response matcher --

describe("toHaveStructuredResponse", () => {
  test("passes when structuredResponse exists", () => {
    expect({
      structuredResponse: { name: "Alice" },
    }).toHaveStructuredResponse();
  });

  test("passes with matching fields", () => {
    expect({
      structuredResponse: { name: "Alice", age: 30 },
    }).toHaveStructuredResponse({ name: "Alice" });
  });

  test("fails when structuredResponse is undefined", () => {
    expect(() => expect({}).toHaveStructuredResponse()).toThrow();
  });
});

// -- Utility helpers --

describe("firstOfType / lastOfType / messagesOfType", () => {
  const messages = [
    new HumanMessage("first human"),
    new AIMessage("first ai"),
    new HumanMessage("second human"),
    new AIMessage("second ai"),
  ];

  test("firstOfType returns the first match", () => {
    const result = firstOfType(messages, AIMessage);
    expect(result).toBeDefined();
    expect(result!.content).toBe("first ai");
  });

  test("lastOfType returns the last match", () => {
    const result = lastOfType(messages, HumanMessage);
    expect(result).toBeDefined();
    expect(result!.content).toBe("second human");
  });

  test("messagesOfType returns all matches", () => {
    const result = messagesOfType(messages, AIMessage);
    expect(result).toHaveLength(2);
  });

  test("firstOfType returns undefined when not found", () => {
    expect(firstOfType(messages, ToolMessage)).toBeUndefined();
  });
});
