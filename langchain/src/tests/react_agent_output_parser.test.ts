import { test, expect } from "@jest/globals";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { AgentAction, AgentFinish } from "@langchain/core/agents.js";
import { ReActSingleInputOutputParser } from "../agents/react/output_parser.js";

test("React agent output parser", async () => {
  const toolName = "AnyTool";
  const outputParser = new ReActSingleInputOutputParser({
    toolNames: [toolName],
  });
  const response: AgentAction | AgentFinish = await outputParser.parse(
    `Action: ${toolName} Action Input: "["input1", "input2", "input3", "input4"]"`
  );

  if (response.returnValues) {
    expect(response.returnValues).toBeNull();
    return;
  }

  const toolInputParsed = JSON.parse(response.toolInput);
  expect(response.tool).toBe(toolName);
  expect(toolInputParsed.length).toBe(4);
});
