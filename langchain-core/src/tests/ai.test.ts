import { test, expect } from "vitest";
import { AIMessageChunk } from "../messages";
import { ToolCallChunk } from "../messages/tool";

const firstChunk: ToolCallChunk = {
  name: undefined,
  args: '{"issueKey": "',
  id: "0",
  type: "tool_call_chunk",
} as const satisfies ToolCallChunk;
const secondChunk: ToolCallChunk = {
  name: undefined,
  args: "INFO-",
  id: "0",
  type: "tool_call_chunk",
} as const satisfies ToolCallChunk;
const thirdChunk: ToolCallChunk = {
  name: undefined,
  args: '10001", "fields": ["summary"]}',
  id: "0",
  type: "tool_call_chunk",
} as const satisfies ToolCallChunk;

const result = new AIMessageChunk({
  content: "",
  tool_call_chunks: [firstChunk, secondChunk, thirdChunk],
});

test("Correct length of tool calls", () => {
  expect(result.tool_calls?.length).toBe(1);
});
test("Correct length of invalid tool calls", () => {
  expect(result.invalid_tool_calls?.length).toBe(0);
});
test("Merge tool_calls args correctly", () => {
  expect(result.tool_calls![0].args).toEqual({
    issueKey: "INFO-10001",
    fields: ["summary"],
  });
});
