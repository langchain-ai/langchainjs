import { test, expect, describe } from "vitest";
import {
  XAI_CODE_EXECUTION_TOOL_TYPE,
  xaiCodeExecution,
  XAICodeExecutionTool,
} from "../code_execution.js";

describe("xaiCodeExecution tool", () => {
  test("creates a tool with correct type", () => {
    const tool = xaiCodeExecution();

    expect(tool).toMatchObject({
      type: XAI_CODE_EXECUTION_TOOL_TYPE,
    } satisfies XAICodeExecutionTool);
  });

  test("creates a tool with type code_interpreter", () => {
    const tool = xaiCodeExecution();

    expect(tool.type).toBe("code_interpreter");
  });

  test("tool has no additional properties", () => {
    const tool = xaiCodeExecution();

    expect(Object.keys(tool)).toEqual(["type"]);
  });

  test("multiple calls return equivalent tools", () => {
    const tool1 = xaiCodeExecution();
    const tool2 = xaiCodeExecution();

    expect(tool1).toEqual(tool2);
  });
});
