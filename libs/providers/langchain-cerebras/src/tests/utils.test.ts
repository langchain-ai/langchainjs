import { test, expect, describe } from "@jest/globals";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { convertToCerebrasMessageParams } from "../utils.js";

describe("convertToCerebrasMessageParams", () => {
  test("should convert ToolMessage with content properly", () => {
    const toolMessage = new ToolMessage({
      content: "42",
      tool_call_id: "139485753823DJDB#JXJX",
      name: "count_globules",
    });

    const result = convertToCerebrasMessageParams([toolMessage]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: "tool",
      content: "42",
      tool_call_id: "139485753823DJDB#JXJX",
    });
  });

  test("should convert a full conversation with tool calls", () => {
    const messages = [
      new HumanMessage(
        "Please tell me the current number of globules in the environment."
      ),
      new AIMessage({
        content: "",
        tool_calls: [
          {
            id: "139485753823DJDB#JXJX",
            name: "count_globules",
            args: {},
            type: "tool_call",
          },
        ],
      }),
      new ToolMessage({
        content: "42",
        tool_call_id: "139485753823DJDB#JXJX",
        name: "count_globules",
      }),
    ];

    const result = convertToCerebrasMessageParams(messages);

    expect(result).toHaveLength(3);

    // Check human message
    expect(result[0]).toEqual({
      role: "user",
      content:
        "Please tell me the current number of globules in the environment.",
    });

    // Check AI message with tool calls
    expect(result[1]).toEqual({
      role: "assistant",
      tool_calls: [
        {
          id: "139485753823DJDB#JXJX",
          type: "function",
          function: {
            name: "count_globules",
            arguments: "{}",
          },
        },
      ],
      content: "",
    });

    // Check tool message
    expect(result[2]).toEqual({
      role: "tool",
      content: "42",
      tool_call_id: "139485753823DJDB#JXJX",
    });
  });

  test("should throw error for non-string tool message content", () => {
    const toolMessage = new ToolMessage({
      content: [
        { type: "text", text: "array" },
        { type: "text", text: "content" },
      ],
      tool_call_id: "test-id",
      name: "test-tool",
    });

    expect(() => convertToCerebrasMessageParams([toolMessage])).toThrow(
      "Non string tool message content is not supported"
    );
  });

  test("should handle system messages", () => {
    const systemMessage = new SystemMessage("You are a helpful assistant.");

    const result = convertToCerebrasMessageParams([systemMessage]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: "system",
      content: "You are a helpful assistant.",
    });
  });
});
