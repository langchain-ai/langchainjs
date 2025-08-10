import { describe, test, expect, jest } from "@jest/globals";
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { ToolCall } from "@langchain/core/messages/tool";
import { customTool } from "../custom.js";
import { ChatOpenAI } from "../../chat_models.js";

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
    const fn = jest.fn(async (input: string) => input);
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
});
