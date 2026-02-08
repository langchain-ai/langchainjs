import { describe, it, expect } from "vitest";
import { ChatOpenAIResponses } from "../responses.js";

describe("service_tier configuration", () => {
  it("includes service_tier from constructor", () => {
    const model = new ChatOpenAIResponses({
      model: "gpt-4o",
      service_tier: "auto",
    });

    const params = model.invocationParams({});
    expect(params.service_tier).toBe("auto");
  });

  it("omits service_tier when not set", () => {
    const model = new ChatOpenAIResponses({
      model: "gpt-4o",
    });

    const params = model.invocationParams({});
    expect(params.service_tier).toBeUndefined();
  });

  it("allows call options to override constructor service_tier", () => {
    const model = new ChatOpenAIResponses({
      model: "gpt-4o",
      service_tier: "auto",
    });

    const params = model.invocationParams({
      service_tier: "flex",
    });
    expect(params.service_tier).toBe("flex");
  });
});

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

    expect("strict" in params).toBe(false);

    expect((params.tools as Array<{ strict?: boolean }>)[0].strict).toBe(true);
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

    expect("strict" in params).toBe(false);

    expect((params.tools as Array<{ strict?: boolean }>)[0].strict).toBe(false);
  });
});
