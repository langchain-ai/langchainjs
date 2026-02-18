import { describe, it, expect } from "vitest";
import { ChatOpenAICompletions } from "../completions.js";

describe("ChatOpenAICompletions constructor", () => {
  it("supports string model shorthand", () => {
    const model = new ChatOpenAICompletions("gpt-4o-mini", {
      temperature: 0.1,
    });
    expect(model.model).toBe("gpt-4o-mini");
    expect(model.temperature).toBe(0.1);
  });
});
