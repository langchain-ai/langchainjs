import { describe, test, expect, vi } from "vitest";
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { ToolCall } from "@langchain/core/messages/tool";
import { customTool } from "../custom.js";
import { ChatOpenAI } from "../../chat_models/index.js";

describe("customTool", () => {
  test("invoking a custom tool will keep tool metadata", async () => {
    const tool = customTool(async (input) => input, {
      name: "text_tool",
      description: "A tool that returns the input",
    });
    const toolCall: ToolCall = {
      id: "123",
      type: "tool_call",
      name: "text_tool",
      args: { input: "Hello" },
    };
    const result = await tool.invoke(toolCall);
    expect(result).toBeInstanceOf(ToolMessage);
    expect(result.metadata).toEqual({
      customTool: {
        name: "text_tool",
        description: "A tool that returns the input",
      },
    });
  });

  test("responding with a tool message from a custom tool will be used correctly", async () => {
    const fn = vi.fn(async (input: string) => input);
    const tool = customTool(fn, {
      name: "text_tool",
      description: "A tool that returns the input",
    });
    const model = new ChatOpenAI({
      model: "gpt-5",
      reasoning: { effort: "minimal" },
    });
    const modelWithTools = model.bindTools([tool]);

    const history: BaseMessage[] = [
      new HumanMessage("Invoke the tool with 'Hello'"),
    ];

    const result = await modelWithTools.invoke(history);
    expect(result).toBeInstanceOf(AIMessage);
    history.push(result);

    const toolOutput = await tool.invoke(result.tool_calls![0]);
    expect(toolOutput).toBeInstanceOf(ToolMessage);
    history.push(toolOutput);

    const result2 = await modelWithTools.invoke(history);
    expect(result2).toBeInstanceOf(AIMessage);
  });

  test("custom tool with grammar format uses Responses API", async () => {
    const MATH_GRAMMAR = `
start: expr
expr: term (SP ADD SP term)* -> add
|| term
term: factor (SP MUL SP factor)* -> mul
|| factor
factor: INT
SP: " "
ADD: "+"
MUL: "*"
%import common.INT
`;

    const mathTool = customTool(
      async () => {
        // Simple mock implementation
        return "42";
      },
      {
        name: "do_math",
        description: "Evaluate a math expression",
        format: { type: "grammar", definition: MATH_GRAMMAR, syntax: "lark" },
      }
    );

    const model = new ChatOpenAI({
      model: "gpt-5",
      reasoning: { effort: "minimal" },
    });
    const modelWithTools = model.bindTools([mathTool]);

    const history: BaseMessage[] = [
      new HumanMessage("Use the tool to calculate 3 + 4"),
    ];

    const result = await modelWithTools.invoke(history);
    expect(result).toBeInstanceOf(AIMessage);

    // Verify tool was called correctly
    expect(result.tool_calls?.[0].name).toBe("do_math");

    history.push(result);
    const toolOutput = await mathTool.invoke(result.tool_calls?.[0]);
    expect(toolOutput).toBeInstanceOf(ToolMessage);
    expect((toolOutput as ToolMessage).content).toBe("42");
  });
});
