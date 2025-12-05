import { describe, it, expect } from "vitest";
import { ChatOpenAIResponses } from "../responses";

describe("strict tool-calling configuration", () => {
  it("falls back to supportsStrictToolCalling when strict is undefined", () => {
    const model = new ChatOpenAIResponses({
      model: "gpt-4o",
      supportsStrictToolCalling: true,
    });

    const params = model.invocationParams({
      tools: [
        {
          type: "function",
          function: {
            name: "test_func",
            description: "testing",
            parameters: { type: "object", properties: {} },
          },
        },
      ],
    });

    expect((params as any).strict).toBeUndefined();

    expect((params.tools as any)[0].strict).toBe(true);
  });

  it("respects user-provided strict option", () => {
    const model = new ChatOpenAIResponses({
      model: "gpt-4o",
      supportsStrictToolCalling: true,
    });

    const params = model.invocationParams({
      strict: false,
      tools: [
        {
          type: "function",
          function: {
            name: "test_func",
            description: "testing",
            parameters: { type: "object", properties: {} },
          },
        },
      ],
    });

    expect((params as any).strict).toBeUndefined();

    expect((params.tools as any)[0].strict).toBe(false);
  });
});
